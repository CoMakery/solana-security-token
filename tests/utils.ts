import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
  Signer,
} from "@solana/web3.js";

export async function topUpWallet(
  connection: Connection,
  address: PublicKey,
  lamports: number
) {
  await connection.confirmTransaction(
    await connection.requestAirdrop(address, lamports),
    "confirmed"
  );
}

export function solToLamports(sol: number): number {
  return sol * LAMPORTS_PER_SOL;
}

export async function createAccount(
  connection: Connection,
  signer: Signer,
  space: number,
  programId = undefined
) {
  const newAccount = Keypair.generate();
  const balanceNeeded = await connection.getMinimumBalanceForRentExemption(
    space
  );
  const instruction = SystemProgram.createAccount({
    fromPubkey: signer.publicKey,
    newAccountPubkey: newAccount.publicKey,
    lamports: balanceNeeded,
    space,
    programId,
  });

  const res = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [signer, newAccount]
  );
  if (res) {
    return newAccount.publicKey;
  }
  return null;
}

export async function createAccountWithSeed(
  connection: Connection,
  programId: PublicKey,
  payer: Keypair,
  seed: string,
  space: number,
  extLamports: number
) {
  const pubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    seed,
    programId
  );
  const accInfo = await connection.getAccountInfo(pubkey);
  if (accInfo != null) return pubkey;

  const fee = await connection.getMinimumBalanceForRentExemption(space);

  const tx = new Transaction();
  tx.add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: payer.publicKey,
      newAccountPubkey: pubkey,
      basePubkey: payer.publicKey,
      seed,
      space,
      lamports: fee + extLamports,
      programId,
    })
  );
  // Execute the transaction against the cluster.
  await sendAndConfirmTransaction(connection, tx, [payer]);
  return pubkey;
}
