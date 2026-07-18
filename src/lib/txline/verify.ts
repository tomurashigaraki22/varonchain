"use client";

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Connection, PublicKey } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { TXLINE_CONFIG } from "./config";
import txoracleIdl from "./idl/txoracle.devnet.json";
import type { Txoracle } from "./types/txoracle.devnet";

type ApiProofNode = { hash: number[]; isRightSibling: boolean };

export type StatValidationApiResponse = {
  summary: {
    fixtureId: number;
    updateStats: {
      updateCount: number;
      minTimestamp: number;
      maxTimestamp: number;
    };
    eventStatsSubTreeRoot: number[];
  };
  subTreeProof: ApiProofNode[];
  mainTreeProof: ApiProofNode[];
  eventStatRoot: number[];
  statsToProve: { key: number; value: number; period: number }[];
  statProofs: ApiProofNode[][];
};

export type OnChainVerifyResult = {
  verified: boolean;
  epochDay: number;
  dailyScoresPda: string;
  ts: number;
};

function mapProof(nodes: ApiProofNode[]) {
  return nodes.map((n) => ({
    hash: Array.from(n.hash),
    isRightSibling: n.isRightSibling,
  }));
}

/**
 * Runs the TxLINE `validateStatV2` on-chain proof check via a read-only
 * simulation, using the user's own connected wallet as fee payer.
 *
 * This must run client-side (not with a server-generated ephemeral
 * keypair): Solana's simulator requires the fee-payer account to actually
 * exist on-chain to model the transaction, even for a pure `.view()` call
 * that never spends real SOL — a freshly generated, never-funded keypair
 * fails simulation with `AccountNotFound`. The user's real wallet already
 * exists on-chain (it paid for the `subscribe` transaction to activate),
 * so reusing it here avoids needing any server-managed funded keypair at
 * all — no real fee is ever charged since this only simulates.
 */
export async function validateStatsOnChain(
  connection: Connection,
  wallet: WalletContextState,
  val: StatValidationApiResponse
): Promise<OnChainVerifyResult> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const provider = new AnchorProvider(connection, wallet as unknown as anchor.Wallet, {
    commitment: "confirmed",
  });
  const program = new Program<Txoracle>(
    txoracleIdl as unknown as Txoracle,
    provider
  );

  const targetTs = val.summary.updateStats.minTimestamp;
  const epochDay = Math.floor(targetTs / 86400000);

  const [dailyScoresPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    TXLINE_CONFIG.programId
  );

  const payload = {
    ts: new BN(targetTs),
    fixtureSummary: {
      fixtureId: new BN(val.summary.fixtureId),
      updateStats: {
        updateCount: val.summary.updateStats.updateCount,
        minTimestamp: new BN(val.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(val.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: Array.from(val.summary.eventStatsSubTreeRoot),
    },
    fixtureProof: mapProof(val.subTreeProof),
    mainTreeProof: mapProof(val.mainTreeProof),
    eventStatRoot: Array.from(val.eventStatRoot),
    stats: val.statsToProve.map((statObj, index) => ({
      stat: statObj,
      statProof: mapProof(val.statProofs[index] ?? []),
    })),
  };

  // Prove each requested stat registered a non-zero value against the
  // anchored root — a generic "did this event really happen" check.
  const strategy = {
    geometricTargets: [],
    distancePredicate: null,
    discretePredicates: val.statsToProve.map((_, index) => ({
      single: {
        index,
        predicate: { threshold: 0, comparison: { greaterThan: {} } },
      },
    })),
  };

  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1_400_000,
  });

  const verified: boolean = await program.methods
    .validateStatV2(payload as never, strategy as never)
    .accounts({ dailyScoresMerkleRoots: dailyScoresPda } as never)
    .preInstructions([computeBudgetIx])
    .view();

  return {
    verified,
    epochDay,
    dailyScoresPda: dailyScoresPda.toBase58(),
    ts: targetTs,
  };
}
