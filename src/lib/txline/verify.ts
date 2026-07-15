import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { TXLINE_CONFIG } from "./config";
import txoracleIdl from "./idl/txoracle.devnet.json";
import type { Txoracle } from "./types/txoracle.devnet";

type ApiProofNode = { hash: number[]; isRightSibling: boolean };

/**
 * Minimal Anchor-compatible wallet backed by an ephemeral, unfunded keypair.
 * `@coral-xyz/anchor`'s own `Wallet` class isn't statically exported from
 * its ESM bundle (Turbopack can't resolve it), so we implement the small
 * interface AnchorProvider needs directly instead.
 */
function ephemeralWallet(keypair: Keypair) {
  return {
    publicKey: keypair.publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      if (tx instanceof Transaction) tx.partialSign(keypair);
      else tx.sign([keypair]);
      return tx;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(
      txs: T[]
    ): Promise<T[]> {
      txs.forEach((tx) => {
        if (tx instanceof Transaction) tx.partialSign(keypair);
        else tx.sign([keypair]);
      });
      return txs;
    },
  };
}

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
 * simulation. No real transaction is submitted and no funded wallet is
 * required — Anchor's `.view()` only simulates, so an ephemeral keypair is
 * sufficient as the nominal fee payer.
 */
export async function validateStatsOnChain(
  val: StatValidationApiResponse
): Promise<OnChainVerifyResult> {
  const connection = new Connection(TXLINE_CONFIG.rpcUrl, "confirmed");
  const wallet = ephemeralWallet(Keypair.generate());
  const provider = new AnchorProvider(connection, wallet, {
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
    program.programId
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
