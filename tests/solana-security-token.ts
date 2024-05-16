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
  ExtraAccountMeta,
  createTransferCheckedInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getExtraAccountMetaAddress,
  getExtraAccountMetas,
  createExecuteInstruction,
  resolveExtraAccountMeta,
} from "@solana/spl-token";
import {
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  AccountInfo,
  PublicKey,
} from "@solana/web3.js";
import { TransferRestrictions } from "../target/types/transfer_restrictions";
// import { SecurityTransferHook } from "../target/types/security_transfer_hook";
import { assert } from "chai";
import { topUpWallet } from "./utils";

const EXTRA_METAS_ACCOUNT_PREFIX = "extra-account-metas";
const ACCESS_CONTROL_PREFIX = "ac";
const WALLET_ROLE_PREFIX = "wallet_role";
const TRANSFER_RESTRICTION_GROUP_PREFIX = "trg";
const TRANSFER_RESTRICTION_DATA_PREFIX = "trd";
const TRANSFER_RULE_PREFIX = "tr";
const SECURITY_ASSOCIATED_ACCOUNT_PREFIX = "saa"; // security associated account
const TRANSFER_RESTRICTION_HOLDER_PREFIX = "trh"; // transfer_restriction_holder


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

  const superAdmin = Keypair.generate();

  const decimals = 6;
  const setupAccessControlArgs = {
    decimals,
    payer: superAdmin.publicKey,
    authority: superAdmin.publicKey,
    name: "XYZ Token",
    uri: "https://e.com",
    symbol: "XYZ",
    delegate: superAdmin.publicKey,
  };

  const contractAdmin = Keypair.generate();
  const walletAdmin = Keypair.generate();
  const reserveAdmin = Keypair.generate();
  const transferAdmin = Keypair.generate();

  let extraMetasAddress: PublicKey = null;
  const validationLen = 8 + 4 + 4 + 7 * 35; // Discriminator, length, pod slice length, pod slice with 7 extra metas


  it("airdrop payer", async () => {
    console.log("Airdropping payer", superAdmin.publicKey.toString());

    await topUpWallet(provider.connection, superAdmin.publicKey, 100000000000000);
  });


  it("Is initialized!", async () => {
    // Size of Mint Account with extension
    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(mintLen);
    const mintKeypair = Keypair.generate();

    const balance = await provider.connection.getBalance(superAdmin.publicKey);
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
        anchor.utils.bytes.utf8.encode(EXTRA_METAS_ACCOUNT_PREFIX),
        mintKeypair.publicKey.toBuffer(),
      ],
      transferRestrictionsProgram.programId
    );
    extraMetasAddress = extraMetasAccount;

    const [accessControlPubkey, accessControlBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode(ACCESS_CONTROL_PREFIX),
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
        .signers([mintKeypair, superAdmin])
        .rpc({ commitment: confirmOptions });
      console.log("InitializeAccessControl transaction signature", tx);

      const accessControlData =
        await transferRestrictionsProgram.account.accessControl.fetch(
          accessControlPubkey,
          confirmOptions
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
      const userWallet = Keypair.generate();
      const userWalletPubkey = userWallet.publicKey;

      const userWalletAssociatedAccountPubkey = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        userWalletPubkey,
        false,
        TOKEN_2022_PROGRAM_ID
      )
      console.log("New Associated Account Pubkey", userWalletAssociatedAccountPubkey.toBase58());

      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          superAdmin.publicKey,
          userWalletAssociatedAccountPubkey,
          userWalletPubkey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID
        )
      )
      const txCreateAssTokenAccount = await sendAndConfirmTransaction(
        provider.connection,
        transaction,
        [superAdmin],
        { commitment: confirmOptions }
      );
      console.log("Create Associated Token Account Transaction Signature", txCreateAssTokenAccount);

      const mintAmount = new anchor.BN(1000000);
      const mintTx = await transferRestrictionsProgram.methods
        .mintSecurities(mintAmount).accountsStrict({
          authority: superAdmin.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          accessControl: accessControlPubkey,
          securityMint: mintKeypair.publicKey,
          destinationAccount: userWalletAssociatedAccountPubkey,
          destinationAuthority: userWalletPubkey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });
      console.log("Mint Securities Transaction Signature", mintTx);

      mintData = await getMint(
        connection,
        mintKeypair.publicKey,
        confirmOptions,
        TOKEN_2022_PROGRAM_ID
      );

      console.log("Mint Data (after MintSecurities)", mintData);

      const assAccountInfo = await getAccount(connection, userWalletAssociatedAccountPubkey, undefined, TOKEN_2022_PROGRAM_ID);
      console.log("Associated Account Info", assAccountInfo);

      // 3. Burn tokens
      const burnAmount = new anchor.BN(700000);
      const burnTx = await transferRestrictionsProgram.methods
        .burnSecurities(burnAmount).accountsStrict({
          authority: superAdmin.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          accessControl: accessControlPubkey,
          securityMint: mintKeypair.publicKey,
          targetAccount: userWalletAssociatedAccountPubkey,
          targetAuthority: userWalletPubkey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([superAdmin])
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

      // === TRANSFER RESTRICTIONS SETUP ===
      // 4. Create Transfer Restriction Data
      console.log("4. Creating Transfer Restriction Data ======================================>");
      const maxHolders = new anchor.BN(10000);
      const [transferRestrictionDataPubkey, transferRestrictionDataBump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from(TRANSFER_RESTRICTION_DATA_PREFIX),
            mintKeypair.publicKey.toBuffer(),
          ],
          transferRestrictionsProgram.programId
        );
      console.log("Transfer Restriction Data Pubkey", transferRestrictionDataPubkey.toBase58());
      const initTransferRestrictionDataTx = await transferRestrictionsProgram.methods
        .initializeTransferRestrictionsData(maxHolders)
        .accountsStrict({
          transferRestrictionData: transferRestrictionDataPubkey,
          accessControlAccount: accessControlPubkey,
          mint: mintKeypair.publicKey,
          payer: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });
      console.log("Initialize Transfer Restrictions Data Transaction Signature", initTransferRestrictionDataTx);

      const transferRestrictionData =
        await transferRestrictionsProgram.account.transferRestrictionData.fetch(
          transferRestrictionDataPubkey
        );
      console.log("transferRestrictionData:", transferRestrictionData);
      assert.deepEqual(transferRestrictionData.securityTokenMint, mintKeypair.publicKey);
      assert.deepEqual(transferRestrictionData.accessControlAccount, accessControlPubkey);
      assert.equal(transferRestrictionData.currentHoldersCount.toNumber(), 0);
      assert.equal(transferRestrictionData.maxHolders.toString(), maxHolders.toString());

      // 5. Create Transfer Group 1
      const transfer_group = new anchor.BN(1, 'be');
      const [transferRestrictionGroupPubkey, transferRestrictionGroupBump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from(TRANSFER_RESTRICTION_GROUP_PREFIX),
            transferRestrictionDataPubkey.toBuffer(),
            transfer_group.toArrayLike(Buffer, "le", 8),
          ],
          transferRestrictionsProgram.programId
        );
      const initTransferGroupTx = await transferRestrictionsProgram.methods
        .initializeTransferRestrictionGroup(transfer_group)
        .accountsStrict({
          transferRestrictionGroup: transferRestrictionGroupPubkey,
          transferRestrictionData: transferRestrictionDataPubkey,
          payer: superAdmin.publicKey,
          accessControlAccount: accessControlPubkey,
          systemProgram: SystemProgram.programId,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });
      console.log("Initialize Transfer Restriction Group Transaction Signature", initTransferGroupTx);

      // 6. Create Transfer Rule 1 -> 1
      console.log("6. Create Transfer Rule 1 -> 1");
      const [transferRulePubkey, transferRulePubkeyBump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from(TRANSFER_RULE_PREFIX),
            transferRestrictionGroupPubkey.toBuffer(),
            transferRestrictionGroupPubkey.toBuffer(),
          ],
          transferRestrictionsProgram.programId
        );
      console.log("Transfer Rule Pubkey", transferRulePubkey.toBase58());

      const tsNow = Date.now() / 1000;
      const lockedUntil = new anchor.BN(tsNow);
      const initTransferRuleTx = await transferRestrictionsProgram.methods
        .initializeTransferRule(lockedUntil)
        .accountsStrict({
          transferRule: transferRulePubkey,
          transferRestrictionData: transferRestrictionDataPubkey,
          transferRestrictionGroupFrom: transferRestrictionGroupPubkey,
          transferRestrictionGroupTo: transferRestrictionGroupPubkey,
          accessControlAccount: accessControlPubkey,
          payer: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });
      console.log("Initialize Transfer Rule Transaction Signature", initTransferRuleTx);

      const transferRuleData = await transferRestrictionsProgram.account.transferRule.fetch(transferRulePubkey, confirmOptions)
      console.log("Transfer Rule Data", transferRuleData);
      assert.equal(transferRuleData.lockedUntil.toString(), lockedUntil.toString());
      assert.equal(transferRuleData.transferGroupIdFrom.toString(), transfer_group.toString());
      assert.equal(transferRuleData.transferGroupIdTo.toString(), transfer_group.toString());
      assert.deepEqual(transferRuleData.transferRestrictionData, transferRestrictionDataPubkey);

      // 7.0. Create security associated account from and to
      const userWalletRecipient = Keypair.generate();
      const userWalletRecipientPubkey = userWalletRecipient.publicKey;
      const userWalletRecipientAssociatedTokenAccountPubkey = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        userWalletRecipientPubkey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      console.log(`Recipient address: ${userWalletRecipientPubkey.toBase58()}, token account: ${userWalletRecipientAssociatedTokenAccountPubkey.toBase58()}`);
      await topUpWallet(provider.connection, userWallet.publicKey, 1000000000000);
      console.log(`User Wallet sender balance: ${await provider.connection.getBalance(userWalletPubkey)}`);

      // 7.1. Create Holder for sender
      console.log("7.1. Create Holder for sender");
      const senderHolderId = new anchor.BN(1);
      const [holderSenderPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(TRANSFER_RESTRICTION_HOLDER_PREFIX),
          transferRestrictionDataPubkey.toBuffer(),
          senderHolderId.toArrayLike(Buffer, "le", 8),
        ],
        transferRestrictionsProgram.programId
      );
      const initSenderHolderTx = await transferRestrictionsProgram.methods
        .initializeTransferRestrictionHolder(senderHolderId)
        .accountsStrict({
          transferRestrictionHolder: holderSenderPubkey,
          transferRestrictionData: transferRestrictionDataPubkey,
          accessControlAccount: accessControlPubkey,
          payer: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });
      console.log("Initialize Sender Holder Transaction Signature", initSenderHolderTx);
      // 7.2. Create Holder for recipient
      console.log("7.2. Create Holder for recipient");
      const recipientHolderId = new anchor.BN(2);
      const [holderRecipientPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(TRANSFER_RESTRICTION_HOLDER_PREFIX),
          transferRestrictionDataPubkey.toBuffer(),
          recipientHolderId.toArrayLike(Buffer, "le", 8),
        ],
        transferRestrictionsProgram.programId
      );
      const initRecipientHolderTx = await transferRestrictionsProgram.methods
        .initializeTransferRestrictionHolder(recipientHolderId)
        .accountsStrict({
          transferRestrictionHolder: holderRecipientPubkey,
          transferRestrictionData: transferRestrictionDataPubkey,
          accessControlAccount: accessControlPubkey,
          payer: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });
      console.log("Initialize Recipient Holder Transaction Signature", initRecipientHolderTx);
      // 7.3. Create Security Associated Account for sender
      console.log("7.3. Create Security Associated Account for sender");
      const [userWalletSenderSecurityAssociatedTokenAccountPubkey] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from(SECURITY_ASSOCIATED_ACCOUNT_PREFIX),
            userWalletAssociatedAccountPubkey.toBuffer(),
          ],
          transferRestrictionsProgram.programId
        );
      const initSecAssocAccountSenderTx = await transferRestrictionsProgram.methods
        .initializeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount: userWalletSenderSecurityAssociatedTokenAccountPubkey,
          group: transferRestrictionGroupPubkey,
          holder: holderSenderPubkey,
          securityToken: mintKeypair.publicKey,
          transferRestrictionData: transferRestrictionDataPubkey,
          userWallet: userWalletPubkey,
          associatedTokenAccount: userWalletAssociatedAccountPubkey,
          payer: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });

      console.log("Initialize Security Associated Account Transaction Signature", initSecAssocAccountSenderTx);

      // 7.4. Create Security Associated Account for recipient
      console.log("7.4. Create Security Associated Account for recipient");
      const transactionCreateAssocAccRecipient = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          superAdmin.publicKey,
          userWalletRecipientAssociatedTokenAccountPubkey,
          userWalletRecipientPubkey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID
        )
      )
      const txCreateRecipientAssTokenAccount = await sendAndConfirmTransaction(
        provider.connection,
        transactionCreateAssocAccRecipient,
        [superAdmin],
        { commitment: confirmOptions }
      );
      console.log("Create Recipient Associated Token Account Transaction Signature", txCreateRecipientAssTokenAccount);

      const [userWalletRecipientSecurityAssociatedTokenAccountPubkey] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from(SECURITY_ASSOCIATED_ACCOUNT_PREFIX),
            userWalletRecipientAssociatedTokenAccountPubkey.toBuffer(),
          ],
          transferRestrictionsProgram.programId
        );

      const initSecAssocAccountRecipientTx = await transferRestrictionsProgram.methods
        .initializeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount: userWalletRecipientSecurityAssociatedTokenAccountPubkey,
          group: transferRestrictionGroupPubkey,
          holder: holderRecipientPubkey,
          securityToken: mintKeypair.publicKey,
          transferRestrictionData: transferRestrictionDataPubkey,
          userWallet: userWalletRecipientPubkey,
          associatedTokenAccount: userWalletRecipientAssociatedTokenAccountPubkey,
          payer: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });
      console.log("Initialize Security Associated Account Transaction Signature", initSecAssocAccountRecipientTx);

      // 7. Create Transfer
      console.log("7. Create Transfer with Hook")
      const transferAmount = BigInt(1000);

      console.log("==================================== ******** ====================================");
      console.log("==================================== FINISHED ====================================");
      console.log("==================================== ******** ====================================");

    } catch (error) {
      console.log("Error", error);
    }
  });

  it("valid extra metas address", async () => {
    // TODO: Update extra metas addresses with the correct values
    const extraMetas: ExtraAccountMeta[] = [
      {
        discriminator: 0,
        addressConfig: Keypair.generate().publicKey.toBuffer(),
        isWritable: false,
        isSigner: false,
      },
      {
        discriminator: 0,
        addressConfig: Keypair.generate().publicKey.toBuffer(),
        isWritable: false,
        isSigner: false,
      },
    ];

    // // Check the account data
    // const extraMetasAddressData = await provider.connection
    //   .getAccountInfo(extraMetasAddress)
    //   assert.equal(extraMetasAddressData.data.length, validationLen);
    //   assert.equal(
    //     extraMetasAddressData.data.subarray(0, 8).compare(
    //       Buffer.from([105, 37, 101, 197, 75, 251, 102, 26]) // SPL discriminator for `Execute` from interface
    //     ),
    //     0
    //   );
    //   assert.equal(
    //     extraMetasAddressData.data.subarray(8, 12).compare(
    //       Buffer.from([74, 0, 0, 0]) // Little endian 74
    //     ),
    //     0
    //   );
    //   assert.equal(
    //     extraMetasAddressData.data.subarray(12, 16).compare(
    //       Buffer.from([2, 0, 0, 0]) // Little endian 2
    //     ),
    //     0
    //   );
    //   const extraMetaToBuffer = (extraMeta: ExtraAccountMeta) => {
    //     const buf = Buffer.alloc(35);
    //     buf.set(extraMeta.addressConfig, 1);
    //     buf.writeUInt8(0, 33); // isSigner
    //     buf.writeUInt8(0, 34); // isWritable
    //     return buf;
    //   };
    //   assert.equal(
    //     extraMetasAddressData.data
    //       .subarray(16, 51)
    //       .compare(extraMetaToBuffer(extraMetas[0])),
    //     0
    //   );
    //   assert.equal(
    //     extraMetasAddressData.data
    //       .subarray(51, 86)
    //       .compare(extraMetaToBuffer(extraMetas[1])),
    //     0
    //   );
  });
});
