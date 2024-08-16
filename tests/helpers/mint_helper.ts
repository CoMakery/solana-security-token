import {
  PublicKey,
  Commitment,
  Connection,
  Transaction,
  Keypair,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import {
  Mint,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
  getAccount,
  Account,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

export class MintHelper {
  mintPubkey: PublicKey;
  commitment: Commitment = "confirmed";
  connection: Connection;
  programId: PublicKey;

  constructor(
    connection: Connection,
    mintPubkey: PublicKey,
    commitment: Commitment = "confirmed",
    programId = TOKEN_2022_PROGRAM_ID
  ) {
    this.connection = connection;
    this.mintPubkey = mintPubkey;
    this.commitment = commitment;
    this.programId = programId;
  }

  async getMint(): Promise<Mint> {
    return getMint(
      this.connection,
      this.mintPubkey,
      this.commitment,
      this.programId
    );
  }

  getAssocciatedTokenAddress(
    walletPubkey: PublicKey,
    allowOwnerOffCurve = false
  ): PublicKey {
    return getAssociatedTokenAddressSync(
      this.mintPubkey,
      walletPubkey,
      allowOwnerOffCurve,
      this.programId
    );
  }

  async getAccount(
    userWalletAssociatedAccountPubkey: PublicKey
  ): Promise<Account> {
    return getAccount(
      this.connection,
      userWalletAssociatedAccountPubkey,
      this.commitment,
      this.programId
    );
  }

  createAssociatedTokenAccountInstruction(
    payerPubkey: PublicKey,
    userWalletPubkey: PublicKey,
    userWalletAssociatedTokenAccountPubkey: PublicKey
  ) {
    return createAssociatedTokenAccountInstruction(
      payerPubkey,
      userWalletAssociatedTokenAccountPubkey,
      userWalletPubkey,
      this.mintPubkey,
      this.programId
    );
  }

  async createAssociatedTokenAccount(
    userWalletPubkey: PublicKey,
    payer: Keypair,
    allowOwnerOffCurve = false
  ): Promise<PublicKey> {
    const userWalletAssociatedTokenAccountPubkey =
      this.getAssocciatedTokenAddress(userWalletPubkey, allowOwnerOffCurve);
    const associatedTokenAccountInstruction =
      this.createAssociatedTokenAccountInstruction(
        payer.publicKey,
        userWalletPubkey,
        userWalletAssociatedTokenAccountPubkey
      );

    const transactionCreateAssocAccRecipient = new Transaction().add(
      associatedTokenAccountInstruction
    );
    await sendAndConfirmTransaction(
      this.connection,
      transactionCreateAssocAccRecipient,
      [payer],
      { commitment: this.commitment }
    );

    return userWalletAssociatedTokenAccountPubkey;
  }
}
