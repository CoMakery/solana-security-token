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

  constructor(
    connection: Connection,
    mintPubkey: PublicKey,
    commitment: Commitment = "confirmed"
  ) {
    this.connection = connection;
    this.mintPubkey = mintPubkey;
    this.commitment = commitment;
  }

  async getMint(): Promise<Mint> {
    return getMint(
      this.connection,
      this.mintPubkey,
      this.commitment,
      TOKEN_2022_PROGRAM_ID
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
      TOKEN_2022_PROGRAM_ID
    );
  }

  async getAccount(
    userWalletAssociatedAccountPubkey: PublicKey
  ): Promise<Account> {
    return getAccount(
      this.connection,
      userWalletAssociatedAccountPubkey,
      this.commitment,
      TOKEN_2022_PROGRAM_ID
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
      TOKEN_2022_PROGRAM_ID
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
