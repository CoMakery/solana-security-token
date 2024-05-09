import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  createInitializeTransferHookInstruction,
  createInitializeMintInstruction,
} from "@solana/spl-token";
import {
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { TransferRestrictions } from "../target/types/transfer_restrictions";
import { SecurityTransferHook } from "../target/types/security_transfer_hook";
import { assert } from "chai";

const ACCESS_CONTROL_PREFIX = "access-control";

describe("solana-security-token", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const transferRestrictionsProgram = anchor.workspace
    .TransferRestrictions as Program<TransferRestrictions>;
  const transferHookProgram = anchor.workspace
    .SecurityTransferHook as Program<SecurityTransferHook>;
  const connection = provider.connection;

  const wallet = provider.wallet as anchor.Wallet;
  const payer = wallet.payer;

  it("Is initialized!", async () => {
    const decimals = 6;
    // Size of Mint Account with extension
    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(mintLen);
    const mintKeypair = Keypair.generate();

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mintKeypair.publicKey,
        wallet.publicKey,
        transferHookProgram.programId,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        wallet.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );

    const txSig = await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [wallet.payer, mintKeypair]
    );
    console.log(`Create Mint Transaction Signature: ${txSig}`);

    const [accessControlPubkey, accessControlBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(ACCESS_CONTROL_PREFIX), mintKeypair.publicKey.toBuffer()],
        transferRestrictionsProgram.programId
      );
    console.log("Access Control Pubkey", accessControlPubkey.toBase58());

    const tx = await transferRestrictionsProgram.methods
      .initializeAccessControl()
      .accounts({
        mint: mintKeypair.publicKey,
        payer: wallet.publicKey,
      })
      .rpc();
    console.log("InitializeAccessControl transaction signature", tx);

    const accessControlData =
      await transferRestrictionsProgram.account.accessControl.fetch(
        accessControlPubkey
      );
    console.log("Access Control Data", accessControlData);

    assert.deepEqual(accessControlData.mint, mintKeypair.publicKey);
  });
});
