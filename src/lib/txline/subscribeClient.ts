"use client";

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  FREE_SERVICE_LEVEL_ID,
  SELECTED_LEAGUES,
  SUBSCRIBE_DURATION_WEEKS,
  TXLINE_CONFIG,
} from "./config";
import txoracleIdl from "./idl/txoracle.devnet.json";
import type { Txoracle } from "./types/txoracle.devnet";

export type ActivationResult = {
  txSig: string;
};

/**
 * Builds and sends the on-chain `subscribe` transaction for the free World
 * Cup tier (service level 1, 4 weeks), using the connected wallet as payer
 * and fee payer. Returns the confirmed transaction signature.
 */
export async function subscribeFreeTier(
  connection: Connection,
  wallet: WalletContextState
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const provider = new AnchorProvider(
    connection,
    wallet as unknown as anchor.Wallet,
    { commitment: "confirmed" }
  );

  const program = new Program<Txoracle>(
    txoracleIdl as unknown as Txoracle,
    provider
  );

  if (!program.programId.equals(TXLINE_CONFIG.programId)) {
    throw new Error(
      `Loaded IDL program ${program.programId.toBase58()} does not match devnet program ${TXLINE_CONFIG.programId.toBase58()}`
    );
  }

  const userTokenAccountAddress = getAssociatedTokenAddressSync(
    TXLINE_CONFIG.txlTokenMint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Ensure the user's Token-2022 associated token account exists.
  const existingAccountInfo = await connection.getAccountInfo(
    userTokenAccountAddress
  );
  if (!existingAccountInfo) {
    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userTokenAccountAddress,
        wallet.publicKey,
        TXLINE_CONFIG.txlTokenMint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    const sig = await wallet.sendTransaction(createAtaTx, connection);
    await connection.confirmTransaction(sig, "confirmed");
  }

  await getAccount(
    connection,
    userTokenAccountAddress,
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TXLINE_CONFIG.txlTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const subscribeTx = await program.methods
    .subscribe(FREE_SERVICE_LEVEL_ID, SUBSCRIBE_DURATION_WEEKS)
    .accounts({
      user: wallet.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TXLINE_CONFIG.txlTokenMint,
      userTokenAccount: userTokenAccountAddress,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as never)
    .transaction();

  const txSig = await wallet.sendTransaction(subscribeTx, connection);
  await connection.confirmTransaction(txSig, "confirmed");

  return txSig;
}

/**
 * Full free-tier onboarding: fetch a guest JWT, subscribe on-chain, sign the
 * activation message with the wallet, then hand the credentials to our
 * backend so the API token never touches client-side storage.
 */
export async function activateFreeTier(
  connection: Connection,
  wallet: WalletContextState
): Promise<ActivationResult> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error("Wallet must support signMessage");
  }

  const jwtRes = await fetch("/api/txline/guest-jwt", { method: "POST" });
  if (!jwtRes.ok) throw new Error("Failed to obtain guest session");
  const { jwt } = (await jwtRes.json()) as { jwt: string };

  const txSig = await subscribeFreeTier(connection, wallet);

  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const messageBytes = new TextEncoder().encode(messageString);
  const signatureBytes = await wallet.signMessage(messageBytes);
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  const activateRes = await fetch("/api/txline/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      txSig,
      jwt,
      walletSignature,
      leagues: SELECTED_LEAGUES,
    }),
  });

  if (!activateRes.ok) {
    const body = await activateRes.text();
    throw new Error(`Activation failed: ${body}`);
  }

  return { txSig };
}
