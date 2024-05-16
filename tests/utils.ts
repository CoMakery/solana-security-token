import {
  Connection,
  PublicKey
} from "@solana/web3.js";


export async function topUpWallet(connection: Connection, address: PublicKey, lamports: number) {
  await connection.confirmTransaction(
    await connection.requestAirdrop(address, lamports),
    "confirmed"
  );
}
