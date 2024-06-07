import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TYPE_SIZE,
  LENGTH_SIZE,
  getMetadataPointerState,
  getTokenMetadata,
  getAccount,
  createTransferCheckedWithTransferHookInstruction,
} from "@solana/spl-token";
import {
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TokenMetadata,
  pack
} from "@solana/spl-token-metadata";

import { TransferRestrictions } from "../target/types/transfer_restrictions";
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

enum Roles {
  None = 0,
  ContractAdmin = 1,
  ReserveAdmin = 2,
  WalletAdmin = 4,
  TransferAdmin = 8,
  All = 15,
}

describe("solana-security-token", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const confirmOptions = "confirmed";

  const transferRestrictionsProgram = anchor.workspace
    .TransferRestrictions as Program<TransferRestrictions>;
  const connection = provider.connection;

  const wallet = provider.wallet as anchor.Wallet;

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
  const mintKeypair = Keypair.generate();
  const [authorityWalletRolePubkey, walletRoleBump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(WALLET_ROLE_PREFIX),
        mintKeypair.publicKey.toBuffer(),
        setupAccessControlArgs.authority.toBuffer(),
      ],
      transferRestrictionsProgram.programId
    );
  const [accessControlPubkey, accessControlBump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(ACCESS_CONTROL_PREFIX),
        mintKeypair.publicKey.toBuffer(),
      ],
      transferRestrictionsProgram.programId
    );
  const userWallet = Keypair.generate();
  const userWalletPubkey = userWallet.publicKey;
  const userWalletAssociatedAccountPubkey = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    userWalletPubkey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const mintAmount = new anchor.BN(1000000);
  const [transferRestrictionDataPubkey, transferRestrictionDataBump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_DATA_PREFIX),
        mintKeypair.publicKey.toBuffer(),
      ],
      transferRestrictionsProgram.programId
    );
  const maxHolders = new anchor.BN(10000);
  const transferGroup1 = new anchor.BN(1);
  const [transferRestrictionGroup1Pubkey, transferRestrictionGroup1Bump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_GROUP_PREFIX),
        transferRestrictionDataPubkey.toBuffer(),
        transferGroup1.toArrayLike(Buffer, "le", 8),
      ],
      transferRestrictionsProgram.programId
    );
  const senderHolderId = new anchor.BN(1);
  const [holderSenderPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(TRANSFER_RESTRICTION_HOLDER_PREFIX),
      transferRestrictionDataPubkey.toBuffer(),
      senderHolderId.toArrayLike(Buffer, "le", 8),
    ],
    transferRestrictionsProgram.programId
  );
  const userWalletRecipient = Keypair.generate();
  const userWalletRecipientPubkey = userWalletRecipient.publicKey;
  const userWalletRecipientAssociatedTokenAccountPubkey =
    getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      userWalletRecipientPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
  const recipientHolderId = new anchor.BN(2);
  const [holderRecipientPubkey] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(TRANSFER_RESTRICTION_HOLDER_PREFIX),
        transferRestrictionDataPubkey.toBuffer(),
        recipientHolderId.toArrayLike(Buffer, "le", 8),
      ],
      transferRestrictionsProgram.programId
    );

  before("tops up wallets", async () => {
    await topUpWallet(
      provider.connection,
      superAdmin.publicKey,
      100000000000000
    );
    await topUpWallet(provider.connection, userWallet.publicKey, 1000000000000);
  });

  it("creates mint with transfer hook, access control and super admin role", async () => {
    // Size of Mint Account with extension
    const extensions = [ExtensionType.TransferHook, ExtensionType.MetadataPointer];
    const mintLen = getMintLen(extensions);

    // Metadata to store in Mint Account
    const metaData: TokenMetadata = {
      updateAuthority: setupAccessControlArgs.authority,
      mint: mintKeypair.publicKey,
      name: "XYZ Security Token",
      symbol: "XYZS",
      uri: "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json",
      additionalMetadata: [["description", "Only Possible On Solana"]],
    };

    // Size of MetadataExtension 2 bytes for type, 2 bytes for length
    const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
    // Size of metadata
    const metadataLen = pack(metaData).length;
    // Minimum lamports required for Mint Account
    const lamports = await connection.getMinimumBalanceForRentExemption(
      mintLen + metadataExtension + metadataLen,
    );

    const balance = await provider.connection.getBalance(superAdmin.publicKey);
    const [extraMetasAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode(EXTRA_METAS_ACCOUNT_PREFIX),
        mintKeypair.publicKey.toBuffer(),
      ],
      transferRestrictionsProgram.programId
    );

    const initializeAccessControlInstr = transferRestrictionsProgram.instruction.initializeAccessControl(
      {
        decimals: setupAccessControlArgs.decimals,
        name: setupAccessControlArgs.name,
        symbol: setupAccessControlArgs.symbol,
        uri: setupAccessControlArgs.uri,
        authority: setupAccessControlArgs.authority
      },
      {
        accounts: {
          payer: setupAccessControlArgs.payer,
          authority: setupAccessControlArgs.authority,
          mint: mintKeypair.publicKey,
          accessControl: accessControlPubkey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        },
      }
    );

    const initializeExtraAccountMetaListInstr = transferRestrictionsProgram.instruction.initializeExtraAccountMetaList({
      accounts: {
        extraMetasAccount: extraMetasAccount,
        securityMint: mintKeypair.publicKey,
        payer: superAdmin.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        accessControl: accessControlPubkey,
        systemProgram: SystemProgram.programId,
      },
    });

    const initializeDeployerRoleInstr = transferRestrictionsProgram.instruction
      .initializeDeployerRole({
        accounts: {
          payer: superAdmin.publicKey,
          accessControl: accessControlPubkey,
          securityToken: mintKeypair.publicKey,
          walletRole: authorityWalletRolePubkey,
          systemProgram: SystemProgram.programId,
        },
      });

    // Add instructions to new transaction
    const transaction = new Transaction().add(
      initializeAccessControlInstr,
      initializeDeployerRoleInstr,
      initializeExtraAccountMetaListInstr,
    );

    try {
      console.log('Mint Keypair', mintKeypair.publicKey.toBase58());
      console.log('Access Control Pubkey', accessControlPubkey.toBase58());
      console.log('Authority Wallet Role Pubkey', authorityWalletRolePubkey.toBase58());

      // Send transaction
      const transactionSignature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [superAdmin, mintKeypair], // Signers
        { commitment: confirmOptions }
      );
      console.log("Transaction Signature", transactionSignature);
    }
    catch (error) {
      console.error(error);
    }

    const accessControlData =
      await transferRestrictionsProgram.account.accessControl.fetch(
        accessControlPubkey,
        confirmOptions
      );
    assert.deepEqual(accessControlData.mint, mintKeypair.publicKey);

    const walletRoleData =
      await transferRestrictionsProgram.account.walletRole.fetch(
        authorityWalletRolePubkey
      );
    assert.deepEqual(walletRoleData.role, Roles.ContractAdmin);
    assert.deepEqual(accessControlData.authority, setupAccessControlArgs.authority);

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

    // Retrieve and verify the metadata pointer state
    const metadataPointer = getMetadataPointerState(mintData);
    assert.deepEqual(metadataPointer.authority, accessControlPubkey)
    assert.deepEqual(metadataPointer.metadataAddress, mintKeypair.publicKey)

    // Retrieve and verify the metadata state
    const metadata = await getTokenMetadata(
      connection,
      mintKeypair.publicKey, // Mint Account address
    );
    assert.deepEqual(metadata.mint, mintKeypair.publicKey);
    assert.deepEqual(metadata.updateAuthority, accessControlPubkey);
    assert.equal(metadata.name, setupAccessControlArgs.name);
    assert.equal(metadata.symbol, setupAccessControlArgs.symbol);
    assert.equal(metadata.uri, setupAccessControlArgs.uri);
  });

  it("creates associated token account for user wallet", async () => {
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        superAdmin.publicKey,
        userWalletAssociatedAccountPubkey,
        userWalletPubkey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    const txCreateAssTokenAccount = await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [superAdmin],
      { commitment: confirmOptions }
    );
    console.log(
      "Create Associated Token Account Transaction Signature",
      txCreateAssTokenAccount
    );
  });

  it("failed to mint without ReserveAdmin role", async () => {
    try {
      await transferRestrictionsProgram.rpc.mintSecurities(mintAmount, {
        accounts: {
          authority: superAdmin.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          accessControl: accessControlPubkey,
          securityMint: mintKeypair.publicKey,
          destinationAccount: userWalletAssociatedAccountPubkey,
          destinationAuthority: userWalletPubkey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        },
        signers: [superAdmin],
        instructions: [],
      });
    } catch ({ error }) {
      assert.equal(error.errorCode.number, 6001);
      assert.equal(error.errorMessage, 'Unauthorized');
      assert.equal(error.errorCode.code, 'Unauthorized')
    }
  })

  it("assigns ReserveAdmin role to super admin", async () => {
    const newRoles = Roles.ReserveAdmin | Roles.ContractAdmin;
    const assignRoleTx = await transferRestrictionsProgram.methods
      .updateWalletRole(newRoles)
      .accountsStrict({
        walletRole: authorityWalletRolePubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        securityToken: mintKeypair.publicKey,
        userWallet: superAdmin.publicKey,
        payer: superAdmin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([superAdmin])
      .rpc({ commitment: confirmOptions });
    console.log("Assign Role Transaction Signature", assignRoleTx);

    const walletRoleData =
      await transferRestrictionsProgram.account.walletRole.fetch(
        authorityWalletRolePubkey
      );
    assert.deepEqual(walletRoleData.role, newRoles);
  });

  it("mints tokens to new account", async () => {
    const mintTx = await transferRestrictionsProgram.methods
      .mintSecurities(mintAmount)
      .accountsStrict({
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

    let mintData = await getMint(
      connection,
      mintKeypair.publicKey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(mintData.supply.toString(), mintAmount.toString());

    const assAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(assAccountInfo.amount.toString(), mintAmount.toString());
  });

  it("burns token by reserve admin", async () => {
    const burnAmount = new anchor.BN(700000);
    const burnTx = await transferRestrictionsProgram.methods
      .burnSecurities(burnAmount)
      .accountsStrict({
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

    const mintData = await getMint(
      connection,
      mintKeypair.publicKey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(
      mintData.supply.toString(),
      mintAmount.sub(burnAmount).toString()
    );
  });

  // // === TRANSFER RESTRICTIONS SETUP ===
  it("creates transfer restriction data", async () => {
    const initTransferRestrictionDataTx =
      await transferRestrictionsProgram.methods
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
    console.log(
      "Initialize Transfer Restrictions Data Transaction Signature",
      initTransferRestrictionDataTx
    );

    const transferRestrictionData =
      await transferRestrictionsProgram.account.transferRestrictionData.fetch(
        transferRestrictionDataPubkey
      );
    assert.deepEqual(
      transferRestrictionData.securityTokenMint,
      mintKeypair.publicKey
    );
    assert.deepEqual(
      transferRestrictionData.accessControlAccount,
      accessControlPubkey
    );
    assert.equal(transferRestrictionData.currentHoldersCount.toNumber(), 0);
    assert.equal(
      transferRestrictionData.maxHolders.toString(),
      maxHolders.toString()
    );
  });

  it("creates transfer restriction group 1", async () => {
    const initTransferGroupTx = await transferRestrictionsProgram.methods
      .initializeTransferRestrictionGroup(transferGroup1)
      .accountsStrict({
        transferRestrictionGroup: transferRestrictionGroup1Pubkey,
        transferRestrictionData: transferRestrictionDataPubkey,
        payer: superAdmin.publicKey,
        accessControlAccount: accessControlPubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([superAdmin])
      .rpc({ commitment: confirmOptions });
    console.log(
      "Initialize Transfer Restriction Group Transaction Signature",
      initTransferGroupTx
    );
    const trGroupData =
      await transferRestrictionsProgram.account.transferRestrictionGroup.fetch(
        transferRestrictionGroup1Pubkey,
        confirmOptions
      );
    assert.equal(trGroupData.id.toString(), transferGroup1.toString());
    assert.equal(trGroupData.maxHolders.toString(), maxHolders.toString());
    assert.equal(
      trGroupData.currentHoldersCount.toString(),
      Number(0).toString()
    );
    assert.deepEqual(
      trGroupData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
  });

  it("creates transfer rule 1 -> 1", async () => {
    const [transferRulePubkey, transferRulePubkeyBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(TRANSFER_RULE_PREFIX),
          transferRestrictionGroup1Pubkey.toBuffer(),
          transferRestrictionGroup1Pubkey.toBuffer(),
        ],
        transferRestrictionsProgram.programId
      );
    console.log("Transfer Rule Pubkey", transferRulePubkey.toBase58());

    const tsNow = Date.now() / 1000;
    const lockedUntil = new anchor.BN(tsNow);
    // const lockedUntil = new anchor.BN(tsNow + 1000); // locked transfer rule
    const initTransferRuleTx = await transferRestrictionsProgram.methods
      .initializeTransferRule(lockedUntil)
      .accountsStrict({
        transferRule: transferRulePubkey,
        transferRestrictionData: transferRestrictionDataPubkey,
        transferRestrictionGroupFrom: transferRestrictionGroup1Pubkey,
        transferRestrictionGroupTo: transferRestrictionGroup1Pubkey,
        accessControlAccount: accessControlPubkey,
        payer: superAdmin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([superAdmin])
      .rpc({ commitment: confirmOptions });
    console.log(
      "Initialize Transfer Rule Transaction Signature",
      initTransferRuleTx
    );

    const transferRuleData =
      await transferRestrictionsProgram.account.transferRule.fetch(
        transferRulePubkey,
        confirmOptions
      );
    assert.equal(
      transferRuleData.lockedUntil.toString(),
      lockedUntil.toString()
    );
    assert.equal(
      transferRuleData.transferGroupIdFrom.toString(),
      transferGroup1.toString()
    );
    assert.equal(
      transferRuleData.transferGroupIdTo.toString(),
      transferGroup1.toString()
    );
    assert.deepEqual(
      transferRuleData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
  });

  it("creates holder for sender", async () => {
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
    console.log(
      "Initialize Sender Holder Transaction Signature",
      initSenderHolderTx
    );
    const holderSenderData =
      await transferRestrictionsProgram.account.transferRestrictionHolder.fetch(
        holderSenderPubkey,
        confirmOptions
      );
    assert.equal(holderSenderData.id.toString(), senderHolderId.toString());
    assert.deepEqual(
      holderSenderData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
    assert.equal(
      holderSenderData.currentWalletsCount.toString(),
      Number(0).toString()
    );
  });

  it("creates holder for recipient", async () => {
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
    console.log(
      "Initialize Recipient Holder Transaction Signature",
      initRecipientHolderTx
    );
    const holderRecipientData =
      await transferRestrictionsProgram.account.transferRestrictionHolder.fetch(
        holderRecipientPubkey,
        confirmOptions
      );
    assert.equal(
      holderRecipientData.id.toString(),
      recipientHolderId.toString()
    );
    assert.deepEqual(
      holderRecipientData.transferRestrictionData,
      transferRestrictionDataPubkey
    );
    assert.equal(
      holderRecipientData.currentWalletsCount.toString(),
      Number(0).toString()
    );
  });

  it("creates security associated token for sender", async () => {
    const [userWalletSenderSecurityAssociatedTokenAccountPubkey] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(SECURITY_ASSOCIATED_ACCOUNT_PREFIX),
          userWalletAssociatedAccountPubkey.toBuffer(),
        ],
        transferRestrictionsProgram.programId
      );
    console.log(
      "Sender Security Associated Account Pubkey",
      userWalletSenderSecurityAssociatedTokenAccountPubkey.toBase58()
    );
    const initSecAssocAccountSenderTx =
      await transferRestrictionsProgram.methods
        .initializeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount:
            userWalletSenderSecurityAssociatedTokenAccountPubkey,
          group: transferRestrictionGroup1Pubkey,
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
    console.log(
      "Initialize Security Associated Account Transaction Signature",
      initSecAssocAccountSenderTx
    );
    const senderSecurityAssociatedAccountData =
      await transferRestrictionsProgram.account.securityAssociatedAccount.fetch(
        userWalletSenderSecurityAssociatedTokenAccountPubkey,
        confirmOptions
      );
    assert.equal(
      senderSecurityAssociatedAccountData.group.toString(),
      transferGroup1.toString()
    );
  });

  it("creates security associated token for recipient", async () => {
    const transactionCreateAssocAccRecipient = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        superAdmin.publicKey,
        userWalletRecipientAssociatedTokenAccountPubkey,
        userWalletRecipientPubkey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    const txCreateRecipientAssTokenAccount = await sendAndConfirmTransaction(
      provider.connection,
      transactionCreateAssocAccRecipient,
      [superAdmin],
      { commitment: confirmOptions }
    );
    console.log(
      "Create Recipient Associated Token Account Transaction Signature",
      txCreateRecipientAssTokenAccount
    );

    const [userWalletRecipientSecurityAssociatedTokenAccountPubkey] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(SECURITY_ASSOCIATED_ACCOUNT_PREFIX),
          userWalletRecipientAssociatedTokenAccountPubkey.toBuffer(),
        ],
        transferRestrictionsProgram.programId
      );
    console.log(
      "Recipient Security Associated Account Pubkey",
      userWalletRecipientSecurityAssociatedTokenAccountPubkey.toBase58()
    );

    const initSecAssocAccountRecipientTx =
      await transferRestrictionsProgram.methods
        .initializeSecurityAssociatedAccount()
        .accountsStrict({
          securityAssociatedAccount:
            userWalletRecipientSecurityAssociatedTokenAccountPubkey,
          group: transferRestrictionGroup1Pubkey,
          holder: holderRecipientPubkey,
          securityToken: mintKeypair.publicKey,
          transferRestrictionData: transferRestrictionDataPubkey,
          userWallet: userWalletRecipientPubkey,
          associatedTokenAccount:
            userWalletRecipientAssociatedTokenAccountPubkey,
          payer: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([superAdmin])
        .rpc({ commitment: confirmOptions });
    console.log(
      "Initialize Security Associated Account Transaction Signature",
      initSecAssocAccountRecipientTx
    );
    const recipientSecurityAssociatedAccountData =
      await transferRestrictionsProgram.account.securityAssociatedAccount.fetch(
        userWalletRecipientSecurityAssociatedTokenAccountPubkey,
        confirmOptions
      );
    assert.equal(
      recipientSecurityAssociatedAccountData.group.toString(),
      transferGroup1.toString()
    );
  });

  it("transfers securities between wallets", async () => {
    const transferAmount = BigInt(1000);
    const transferWithHookInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        provider.connection,
        userWalletAssociatedAccountPubkey,
        mintKeypair.publicKey,
        userWalletRecipientAssociatedTokenAccountPubkey,
        userWallet.publicKey,
        transferAmount,
        decimals,
        undefined,
        confirmOptions,
        TOKEN_2022_PROGRAM_ID
      );

    const transferWithHookTx = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(transferWithHookInstruction),
      [userWallet],
      { commitment: confirmOptions }
    );
    console.log(
      "Transfer Securities Transaction Signature",
      transferWithHookTx
    );

    const senderAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    const recipientAccountInfo = await getAccount(
      connection,
      userWalletRecipientAssociatedTokenAccountPubkey,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    assert.deepEqual(senderAccountInfo.amount, BigInt(299000));
    assert.equal(
      recipientAccountInfo.amount.toString(),
      transferAmount.toString()
    );
  });

  it("freezes user wallet", async () => {
    let assAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(assAccountInfo.isFrozen, false);
    try {
      const freezeTx = await transferRestrictionsProgram.methods
        .freezeWallet()
        .accountsStrict({
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
      assert.fail("Expected error not thrown");
    } catch ({ error }) {
      assert.equal(error.errorCode.number, 6001);
      assert.equal(error.errorMessage, 'Unauthorized');
      assert.equal(error.errorCode.code, 'Unauthorized')
    }
  });

  it("assigns Transfer role to super admin", async () => {
    const newRoles = Roles.ReserveAdmin | Roles.ContractAdmin | Roles.TransferAdmin;
    const assignRoleTx = await transferRestrictionsProgram.methods
      .updateWalletRole(newRoles)
      .accountsStrict({
        walletRole: authorityWalletRolePubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        securityToken: mintKeypair.publicKey,
        userWallet: superAdmin.publicKey,
        payer: superAdmin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([superAdmin])
      .rpc({ commitment: confirmOptions });
    console.log("Assign Role Transaction Signature", assignRoleTx);

    const walletRoleData =
      await transferRestrictionsProgram.account.walletRole.fetch(
        authorityWalletRolePubkey
      );
    assert.deepEqual(walletRoleData.role, newRoles);
  });

  it("freezes user wallet", async () => {
    let assAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(assAccountInfo.isFrozen, false);

    const freezeTx = await transferRestrictionsProgram.methods
      .freezeWallet()
      .accountsStrict({
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
    console.log("Freeze Wallet Transaction Signature", freezeTx);

    assAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(assAccountInfo.isFrozen, true);
    assert.deepEqual(assAccountInfo.amount, BigInt(299000));
  });
});
