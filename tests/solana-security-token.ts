import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  getMetadataPointerState,
  getTokenMetadata,
  createTransferCheckedWithTransferHookInstruction,
  getAccount,
} from "@solana/spl-token";
import {
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";

import { TransferRestrictions } from "../target/types/transfer_restrictions";
import { AccessControl } from "../target/types/access_control";
import { assert } from "chai";
import { solToLamports, topUpWallet } from "./utils";
import { AccessControlHelper, Roles } from "./helpers/access-control_helper";

import { TransferRestrictionsHelper } from "./helpers/transfer-restrictions_helper";
import { MintHelper } from "./helpers/mint_helper";

describe("solana-security-token", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const confirmOptions = "confirmed";

  const accessControlProgram = anchor.workspace
    .AccessControl as Program<AccessControl>;
  const transferRestrictionsProgram = anchor.workspace
    .TransferRestrictions as Program<TransferRestrictions>;
  const connection = provider.connection;

  const wallet = provider.wallet as anchor.Wallet;

  const superAdmin = Keypair.generate();

  const minWalletBalance = new anchor.BN(0);
  const decimals = 6;
  const setupAccessControlArgs = {
    decimals,
    payer: superAdmin.publicKey,
    authority: superAdmin.publicKey,
    name: "XYZ Token",
    uri: "https://e.com",
    symbol: "XYZ",
    delegate: superAdmin.publicKey,
    minWalletBalance,
    maxTotalSupply: new anchor.BN(1_000_000_000),
    hookProgramId: transferRestrictionsProgram.programId,
  };
  const mintKeypair = Keypair.generate();
  const mintHelper = new MintHelper(connection, mintKeypair.publicKey);
  const accessControlHelper = new AccessControlHelper(
    accessControlProgram,
    mintKeypair.publicKey
  );
  const transferRestrictionsHelper = new TransferRestrictionsHelper(
    transferRestrictionsProgram,
    mintKeypair.publicKey,
    accessControlHelper.accessControlPubkey
  );

  const [authorityWalletRolePubkey] = accessControlHelper.walletRolePDA(
    setupAccessControlArgs.authority
  );
  const [accessControlPubkey, accessControlBump] =
    accessControlHelper.accessControlPDA();
  const userWallet = Keypair.generate();
  const userWalletPubkey = userWallet.publicKey;
  const userWalletAssociatedAccountPubkey = mintHelper.getAssocciatedTokenAddress(
    userWalletPubkey
  );

  const mintAmount = new anchor.BN(1000000);
  const [transferRestrictionDataPubkey] =
    transferRestrictionsHelper.transferRestrictionDataPDA();
  const maxHolders = new anchor.BN(10000);
  const transferGroup1 = new anchor.BN(1);
  const [transferRestrictionGroup1Pubkey] =
    transferRestrictionsHelper.groupPDA(transferGroup1);
  const senderHolderId = new anchor.BN(1);
  const [holderSenderPubkey] =
    transferRestrictionsHelper.holderPDA(senderHolderId);
  const userWalletRecipient = Keypair.generate();
  const userWalletRecipientPubkey = userWalletRecipient.publicKey;
  const userWalletRecipientAssociatedTokenAccountPubkey =
    mintHelper.getAssocciatedTokenAddress(userWalletRecipientPubkey);
  const recipientHolderId = new anchor.BN(2);
  const [holderRecipientPubkey] =
    transferRestrictionsHelper.holderPDA(recipientHolderId);

  before("tops up wallets", async () => {
    await topUpWallet(
      provider.connection,
      superAdmin.publicKey,
      solToLamports(10)
    );
    await topUpWallet(
      provider.connection,
      userWallet.publicKey,
      solToLamports(10)
    );
  });

  it("creates mint with transfer hook, access control and super admin role", async () => {
    const initializeAccessControlInstr =
      accessControlHelper.initializeAccessControlInstruction(
        setupAccessControlArgs
      );

    const initializeExtraAccountMetaListInstr =
      transferRestrictionsHelper.initializeExtraMetasAccount(
        superAdmin.publicKey,
        authorityWalletRolePubkey
      );

    const initializeDeployerRoleInstr =
      accessControlHelper.initializeDeployerRoleInstruction(
        superAdmin.publicKey
      );

    // Add instructions to new transaction
    const transaction = new Transaction().add(
      initializeAccessControlInstr,
      initializeDeployerRoleInstr,
      initializeExtraAccountMetaListInstr
    );

    try {
      console.log("Mint Keypair", mintKeypair.publicKey.toBase58());
      console.log("Access Control Pubkey", accessControlPubkey.toBase58());
      console.log(
        "Authority Wallet Role Pubkey",
        authorityWalletRolePubkey.toBase58()
      );

      // Send transaction
      const transactionSignature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [superAdmin, mintKeypair], // Signers
        { commitment: confirmOptions }
      );
      console.log("Transaction Signature", transactionSignature);
    } catch (error) {
      console.error(error);
    }

    const accessControlData = await accessControlHelper.accessControlData();
    assert.deepEqual(accessControlData.mint, mintKeypair.publicKey);

    const walletRoleData = await accessControlHelper.walletRoleData(
      authorityWalletRolePubkey
    );
    assert.deepEqual(walletRoleData.role, Roles.ContractAdmin);
    assert.deepEqual(
      accessControlData.authority,
      setupAccessControlArgs.authority
    );

    let mintData = await mintHelper.getMint();
    assert.deepEqual(mintData.mintAuthority, accessControlPubkey);
    assert.deepEqual(mintData.supply, BigInt(0));
    assert.deepEqual(mintData.decimals, decimals);
    assert.deepEqual(mintData.isInitialized, true);
    assert.deepEqual(mintData.freezeAuthority, accessControlPubkey);

    // Retrieve and verify the metadata pointer state
    const metadataPointer = getMetadataPointerState(mintData);
    assert.deepEqual(metadataPointer.authority, accessControlPubkey);
    assert.deepEqual(metadataPointer.metadataAddress, mintKeypair.publicKey);

    // Retrieve and verify the metadata state
    const metadata = await getTokenMetadata(
      connection,
      mintKeypair.publicKey // Mint Account address
    );
    assert.deepEqual(metadata.mint, mintKeypair.publicKey);
    assert.deepEqual(metadata.updateAuthority, accessControlPubkey);
    assert.equal(metadata.name, setupAccessControlArgs.name);
    assert.equal(metadata.symbol, setupAccessControlArgs.symbol);
    assert.equal(metadata.uri, setupAccessControlArgs.uri);
  });

  it("creates associated token account for user wallet", async () => {
    await mintHelper.createAssociatedTokenAccount(userWalletPubkey, superAdmin);
  });

  it("failed to mint without ReserveAdmin role", async () => {
    try {
      await accessControlHelper.mintSecurities(
        mintAmount,
        userWalletPubkey,
        userWalletAssociatedAccountPubkey,
        superAdmin
      );
    } catch ({ error }) {
      assert.equal(error.errorCode.number, 6000);
      assert.equal(error.errorMessage, "Unauthorized");
      assert.equal(error.errorCode.code, "Unauthorized");
    }
  });

  it("assigns ReserveAdmin role to super admin", async () => {
    const newRoles = Roles.ReserveAdmin | Roles.ContractAdmin;
    const assignRoleTx = await accessControlHelper.updateWalletRole(
      superAdmin.publicKey,
      newRoles,
      superAdmin
    );
    console.log("Assign Role Transaction Signature", assignRoleTx);

    const walletRoleData = await accessControlHelper.walletRoleData(
      authorityWalletRolePubkey
    );
    assert.deepEqual(walletRoleData.role, newRoles);
  });

  it("fails to mint more than max total supply", async () => {
    const mintAmount = setupAccessControlArgs.maxTotalSupply.addn(1);
    try {
      await accessControlProgram.rpc.mintSecurities(mintAmount, {
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

      assert.fail('Minting more than max total supply should fail');
    } catch ({ error }) {
      assert.equal(error.errorCode.number, 6002);
      assert.equal(error.errorMessage, "Cannot mint more than max total supply");
      assert.equal(error.errorCode.code, "MintExceedsMaxTotalSupply");
    }
  });

  it("mints tokens to new account", async () => {
    const mintTx = await accessControlHelper.mintSecurities(
      mintAmount,
      userWalletPubkey,
      userWalletAssociatedAccountPubkey,
      superAdmin
    );
    console.log("Mint Securities Transaction Signature", mintTx);

    let mintData = await mintHelper.getMint();
    assert.equal(mintData.supply.toString(), mintAmount.toString());

    const assAccountInfo = await mintHelper.getAccount(
      userWalletAssociatedAccountPubkey
    );
    assert.equal(assAccountInfo.amount.toString(), mintAmount.toString());
  });

  it("burns token by reserve admin", async () => {
    const burnAmount = new anchor.BN(700000);
    const burnTx = await accessControlHelper.burnSecurities(
      burnAmount,
      userWalletPubkey,
      userWalletAssociatedAccountPubkey,
      superAdmin
    );
    console.log("Burn Securities Transaction Signature", burnTx);

    const mintData = await mintHelper.getMint();
    assert.equal(
      mintData.supply.toString(),
      mintAmount.sub(burnAmount).toString()
    );
  });

  // === TRANSFER RESTRICTIONS SETUP ===
  it("creates transfer restriction data", async () => {
    const initTransferRestrictionDataTx =
      await transferRestrictionsHelper.initializeTransferRestrictionData(
        maxHolders,
        minWalletBalance,
        authorityWalletRolePubkey,
        superAdmin
      );
    console.log(
      "Initialize Transfer Restrictions Data Transaction Signature",
      initTransferRestrictionDataTx
    );

    const transferRestrictionData =
      await transferRestrictionsHelper.transferRestrictionData();
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
    const initTransferGroupTx =
      await transferRestrictionsHelper.initializeTransferRestrictionGroup(
        transferGroup1,
        superAdmin
      );
    console.log(
      "Initialize Transfer Restriction Group Transaction Signature",
      initTransferGroupTx
    );
    const trGroupData = await transferRestrictionsHelper.groupData(
      transferRestrictionGroup1Pubkey
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
    const [transferRulePubkey] = transferRestrictionsHelper.transferRulePDA(
      transferRestrictionGroup1Pubkey,
      transferRestrictionGroup1Pubkey
    );
    console.log("Transfer Rule Pubkey", transferRulePubkey.toBase58());

    const tsNow = Date.now() / 1000;
    const lockedUntil = new anchor.BN(tsNow);
    // const lockedUntil = new anchor.BN(tsNow + 1000); // locked transfer rule
    const initTransferRuleTx =
      await transferRestrictionsHelper.initializeTransferRule(
        lockedUntil,
        transferRestrictionGroup1Pubkey,
        transferRestrictionGroup1Pubkey,
        superAdmin
      );
    console.log(
      "Initialize Transfer Rule Transaction Signature",
      initTransferRuleTx
    );

    const transferRuleData = await transferRestrictionsHelper.transferRuleData(
      transferRulePubkey
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
    const initSenderHolderTx =
      await transferRestrictionsHelper.initializeTransferRestrictionHolder(
        senderHolderId,
        superAdmin
      );
    console.log(
      "Initialize Sender Holder Transaction Signature",
      initSenderHolderTx
    );
    const holderSenderData = await transferRestrictionsHelper.holderData(
      holderSenderPubkey
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
    const initRecipientHolderTx =
      await transferRestrictionsHelper.initializeTransferRestrictionHolder(
        recipientHolderId,
        superAdmin
      );
    console.log(
      "Initialize Recipient Holder Transaction Signature",
      initRecipientHolderTx
    );
    const holderRecipientData = await transferRestrictionsHelper.holderData(
      holderRecipientPubkey
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
      transferRestrictionsHelper.securityAssociatedAccountPDA(
        userWalletAssociatedAccountPubkey
      );
    console.log(
      "Sender Security Associated Account Pubkey",
      userWalletSenderSecurityAssociatedTokenAccountPubkey.toBase58()
    );
    const initSecAssocAccountSenderTx =
      await transferRestrictionsHelper.initializeSecurityAssociatedAccount(
        transferRestrictionGroup1Pubkey,
        holderSenderPubkey,
        userWalletPubkey,
        userWalletAssociatedAccountPubkey,
        authorityWalletRolePubkey,
        superAdmin
      );
    console.log(
      "Initialize Security Associated Account Transaction Signature",
      initSecAssocAccountSenderTx
    );
    const senderSecurityAssociatedAccountData =
      await transferRestrictionsHelper.securityAssociatedAccountData(
        userWalletSenderSecurityAssociatedTokenAccountPubkey
      );
    assert.equal(
      senderSecurityAssociatedAccountData.group.toString(),
      transferGroup1.toString()
    );
  });

  it("creates security associated token for recipient", async () => {
    try {
      await mintHelper.createAssociatedTokenAccount(
        userWalletRecipientPubkey,
        superAdmin
      );
    } catch (error) {
      console.error(error);
      throw error;
    }

    const [userWalletRecipientSecurityAssociatedTokenAccountPubkey] =
      transferRestrictionsHelper.securityAssociatedAccountPDA(
        userWalletRecipientAssociatedTokenAccountPubkey
      );
    console.log(
      "Recipient Security Associated Account Pubkey",
      userWalletRecipientSecurityAssociatedTokenAccountPubkey.toBase58()
    );

    try {
      const initSecAssocAccountRecipientTx =
        await transferRestrictionsHelper.initializeSecurityAssociatedAccount(
          transferRestrictionGroup1Pubkey,
          holderRecipientPubkey,
          userWalletRecipientPubkey,
          userWalletRecipientAssociatedTokenAccountPubkey,
          authorityWalletRolePubkey,
          superAdmin
        );
      console.log(
        "Initialize Security Associated Account Transaction Signature",
        initSecAssocAccountRecipientTx
      );
    } catch (error) {
      console.error(error);
      throw error;
    }

    const recipientSecurityAssociatedAccountData =
      await transferRestrictionsHelper.securityAssociatedAccountData(
        userWalletRecipientSecurityAssociatedTokenAccountPubkey
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

    const senderAccountInfo = await mintHelper.getAccount(
      userWalletAssociatedAccountPubkey
    );
    const recipientAccountInfo = await mintHelper.getAccount(
      userWalletRecipientAssociatedTokenAccountPubkey
    );
    assert.deepEqual(senderAccountInfo.amount, BigInt(299000));
    assert.equal(
      recipientAccountInfo.amount.toString(),
      transferAmount.toString()
    );
  });

  const reserveAdmin = Keypair.generate();
  it("assigns Reserve Admin role to new wallet", async () => {
    const newRoles = Roles.ReserveAdmin;

    const txSignature = await accessControlHelper.initializeWalletRole(
      reserveAdmin.publicKey,
      newRoles,
      superAdmin
    );
    console.log("Assign Role Transaction Signature", txSignature);

    const walletRolePDA = accessControlHelper.walletRolePDA(
      reserveAdmin.publicKey
    )[0];
    const walletRoleData = await accessControlHelper.walletRoleData(
      walletRolePDA
    );
    assert.deepEqual(walletRoleData.role, newRoles);
    await topUpWallet(
      provider.connection,
      reserveAdmin.publicKey,
      solToLamports(1)
    );
  });

  const forceTransferAmount = 1000;
  it("forces transfer between", async () => {
    let senderAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    const initialSenderAmount = senderAccountInfo.amount;
    let recipientAccountInfo = await getAccount(
      connection,
      userWalletRecipientAssociatedTokenAccountPubkey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    const initialRecipientAmount = recipientAccountInfo.amount;

    const txSignature = await accessControlHelper.forceTransferBetween(
      forceTransferAmount,
      userWalletPubkey,
      userWalletAssociatedAccountPubkey,
      userWalletRecipientPubkey,
      userWalletRecipientAssociatedTokenAccountPubkey,
      reserveAdmin,
      connection
    );

    console.log("Force Transfer Transaction Signature", txSignature);

    senderAccountInfo = await getAccount(
      connection,
      userWalletAssociatedAccountPubkey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );
    recipientAccountInfo = await getAccount(
      connection,
      userWalletRecipientAssociatedTokenAccountPubkey,
      confirmOptions,
      TOKEN_2022_PROGRAM_ID
    );

    assert.deepEqual(
      senderAccountInfo.amount.toString(),
      (initialSenderAmount - BigInt(forceTransferAmount)).toString()
    );
    assert.equal(
      recipientAccountInfo.amount.toString(),
      (initialRecipientAmount + BigInt(forceTransferAmount)).toString()
    );
  });

  it("fails to freeze user wallet without Transfer role", async () => {
    let assAccountInfo = await mintHelper.getAccount(
      userWalletAssociatedAccountPubkey
    );
    assert.equal(assAccountInfo.isFrozen, false);
    try {
      await accessControlHelper.freezeWallet(
        userWalletPubkey,
        userWalletAssociatedAccountPubkey,
        superAdmin
      );
      assert.fail("Expected error not thrown");
    } catch ({ error }) {
      assert.equal(error.errorCode.number, 6000);
      assert.equal(error.errorMessage, "Unauthorized");
      assert.equal(error.errorCode.code, "Unauthorized");
    }
  });

  it("assigns Transfer role to super admin", async () => {
    const newRoles =
      Roles.ReserveAdmin | Roles.ContractAdmin | Roles.TransferAdmin;
    const assignRoleTx = await accessControlHelper.updateWalletRole(
      superAdmin.publicKey,
      newRoles,
      superAdmin
    );
    console.log("Assign Role Transaction Signature", assignRoleTx);

    const walletRoleData = await accessControlHelper.walletRoleData(
      authorityWalletRolePubkey
    );
    assert.deepEqual(walletRoleData.role, newRoles);
  });

  it("freezes user wallet", async () => {
    let assAccountInfo = await mintHelper.getAccount(
      userWalletAssociatedAccountPubkey
    );
    assert.equal(assAccountInfo.isFrozen, false);

    const freezeTx = await accessControlHelper.freezeWallet(
      userWalletPubkey,
      userWalletAssociatedAccountPubkey,
      superAdmin
    );
    console.log("Freeze Wallet Transaction Signature", freezeTx);

    assAccountInfo = await mintHelper.getAccount(
      userWalletAssociatedAccountPubkey
    );
    assert.equal(assAccountInfo.isFrozen, true);
    assert.deepEqual(assAccountInfo.amount, BigInt(298000));
  });
});
