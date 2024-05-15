import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  createInitializeTransferHookInstruction,
  createInitializeMintInstruction,
  getMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import {
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  Connection,
} from "@solana/web3.js";
import { TransferRestrictions } from "../target/types/transfer_restrictions";
// import { SecurityTransferHook } from "../target/types/security_transfer_hook";
import { assert } from "chai";

const ACCESS_CONTROL_PREFIX = "access_control";
const WALLET_ROLE_PREFIX = "wallet_role";

describe("solana-security-token", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const confirmOptions = 'confirmed'

  const transferRestrictionsProgram = anchor.workspace
    .TransferRestrictions as Program<TransferRestrictions>;
  // const transferHookProgram = anchor.workspace
  //   .SecurityTransferHook as Program<SecurityTransferHook>;
  const connection = provider.connection;

  const wallet = provider.wallet as anchor.Wallet;
  // const payer = wallet.payer;

  const payer = Keypair.generate();

  const decimals = 6;
  const setupAccessControlArgs = {
    decimals,
    payer: payer.publicKey,
    authority: payer.publicKey,
    name: "XYZ Token",
    uri: "https://e.com",
    symbol: "XYZ",
    delegate: payer.publicKey,
  };

  const contractAdmin = Keypair.generate();
  const walletAdmin = Keypair.generate();
  const reserveAdmin = Keypair.generate();
  const transferAdmin = Keypair.generate();

  it("airdrop payer", async () => {
    console.log("Airdropping payer", payer.publicKey.toString());

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(payer.publicKey, 1000000000000000),
      confirmOptions
    );
  });


  it("Is initialized!", async () => {
    // Size of Mint Account with extension
    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(mintLen);
    const mintKeypair = Keypair.generate();

    const balance = await provider.connection.getBalance(payer.publicKey);
    console.log("Payer balance", balance);

    // const transaction = new Transaction().add(
    //   SystemProgram.createAccount({
    //     fromPubkey: wallet.publicKey,
    //     newAccountPubkey: mintKeypair.publicKey,
    //     space: mintLen,
    //     lamports: lamports,
    //     programId: TOKEN_2022_PROGRAM_ID,
    //   }),
    //   createInitializeTransferHookInstruction(
    //     mintKeypair.publicKey,
    //     wallet.publicKey,
    //     transferHookProgram.programId,
    //     TOKEN_2022_PROGRAM_ID
    //   ),
    //   createInitializeMintInstruction(
    //     mintKeypair.publicKey,
    //     decimals,
    //     wallet.publicKey,
    //     null,
    //     TOKEN_2022_PROGRAM_ID
    //   )
    // );

    // const txSig = await sendAndConfirmTransaction(
    //   provider.connection,
    //   transaction,
    //   [wallet.payer, mintKeypair]
    // );
    // console.log(`Create Mint Transaction Signature: ${txSig}`);

    console.log('mintKeypair.publicKey:', mintKeypair.publicKey.toBase58());
    const [extraMetasAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("extra-account-metas"),
        mintKeypair.publicKey.toBuffer(),
      ],
      transferRestrictionsProgram.programId
    );

    const [accessControlPubkey, accessControlBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("access_control"),
          mintKeypair.publicKey.toBuffer()
        ],
        transferRestrictionsProgram.programId
      );
    console.log("Access Control Pubkey", accessControlPubkey.toBase58());
    console.log("transferRestrictionsProgram.programId", transferRestrictionsProgram.programId.toBase58());


    const [authorityWalletRolePubkey, walletRoleBump] =
      anchor.web3.PublicKey.findProgramAddressSync([
        Buffer.from(WALLET_ROLE_PREFIX),
        mintKeypair.publicKey.toBuffer(),
        setupAccessControlArgs.authority.toBuffer()
      ],
        transferRestrictionsProgram.programId
      );
    console.log("Wallet Role Pubkey", authorityWalletRolePubkey.toBase58());

    try {
      // 1. Initialize Access Control and Mint
      const tx = await transferRestrictionsProgram.methods
        .initializeAccessControl({
          decimals: setupAccessControlArgs.decimals,
          name: setupAccessControlArgs.name,
          symbol: setupAccessControlArgs.symbol,
          uri: setupAccessControlArgs.uri,
          delegate: setupAccessControlArgs.delegate ? new anchor.web3.PublicKey(setupAccessControlArgs.delegate) : null,
        })
        .accountsStrict({
          payer: setupAccessControlArgs.payer,
          authority: setupAccessControlArgs.authority,
          mint: mintKeypair.publicKey,
          accessControl: accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          extraMetasAccount: extraMetasAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([mintKeypair, payer])
        .rpc({ commitment: confirmOptions });
      console.log("InitializeAccessControl transaction signature", tx);
      
      const accessControlData =
        await transferRestrictionsProgram.account.accessControl.fetch(
          accessControlPubkey
        );
      console.log("Access Control Data", accessControlData);
      assert.deepEqual(accessControlData.mint, mintKeypair.publicKey);

      const walletRoleData = await transferRestrictionsProgram.account.walletRole.fetch(authorityWalletRolePubkey);
      console.log("Wallet Role Data", walletRoleData);
      assert.deepEqual(walletRoleData.role, 15);

      let mintData = await getMint(
        connection, 
        mintKeypair.publicKey,
        confirmOptions,
        TOKEN_2022_PROGRAM_ID
      );
      assert.deepEqual(mintData.mintAuthority, accessControlPubkey);
      assert.deepEqual(mintData.supply, BigInt(0));
      assert.deepEqual(mintData.decimals, decimals);
      assert.deepEqual(mintData.isInitialized, true);
      assert.deepEqual(mintData.freezeAuthority, accessControlPubkey);

      console.log("Mint Data", mintData);

      // 2. Mint tokens to new account
      const newAccount = Keypair.generate();
      const newAccountPubkey = newAccount.publicKey;

      const newAssociatedAccountPubkey = getAssociatedTokenAddressSync(
				mintKeypair.publicKey,
				newAccountPubkey,
				false,
				TOKEN_2022_PROGRAM_ID
			)
      console.log("New Associated Account Pubkey", newAssociatedAccountPubkey.toBase58());
      

      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          newAssociatedAccountPubkey,
          newAccountPubkey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID
        )
      )
      const txCreateAssTokenAccount = await sendAndConfirmTransaction(provider.connection, transaction, [
        payer,
      ]);
      console.log("Create Associated Token Account Transaction Signature", txCreateAssTokenAccount);

      const mintAmount = new anchor.BN(1000000);
      const mintTx = await transferRestrictionsProgram.methods
        .mintSecurities(mintAmount).accountsStrict({
          authority: payer.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          accessControl: accessControlPubkey,
          securityMint: mintKeypair.publicKey,
          destinationAccount: newAssociatedAccountPubkey,
          destinationAuthority: newAccountPubkey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([payer])
        .rpc({ commitment: confirmOptions });
      console.log("Mint Securities Transaction Signature", mintTx);

      mintData = await getMint(
        connection, 
        mintKeypair.publicKey,
        confirmOptions,
        TOKEN_2022_PROGRAM_ID
      );

      console.log("Mint Data (after MintSecurities)", mintData);

      const assAccountInfo = await getAccount(connection, newAssociatedAccountPubkey, undefined, TOKEN_2022_PROGRAM_ID);
      console.log("Associated Account Info", assAccountInfo);

      // 3. Burn tokens
      const burnAmount = new anchor.BN(700000);
      const burnTx = await transferRestrictionsProgram.methods
      .burnSecurities(burnAmount).accountsStrict({
        authority: payer.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: accessControlPubkey,
        securityMint: mintKeypair.publicKey,
        targetAccount: newAssociatedAccountPubkey,
        targetAuthority: newAccountPubkey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([payer])
      .rpc({ commitment: confirmOptions });
      console.log("Burn Securities Transaction Signature", burnTx);

      mintData = await getMint(
        connection, 
        mintKeypair.publicKey,
        confirmOptions,
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(mintData.supply.toString(), mintAmount.sub(burnAmount).toString());
      console.log("Mint Data (after BurnSecurities)", mintData);

      // 4. Create Transfer Group 1
      
    } catch (error) {
      console.log("Error", error);
    }
  });
});
