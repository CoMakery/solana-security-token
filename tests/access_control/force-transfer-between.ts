import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  PublicKey
} from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { TokenTransferHookAccountDataNotFound } from "@solana/spl-token";

describe("Access Control force transfer between", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://e.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 10000,
  };
  let testEnvironment: TestEnvironment;
  let reserveAdminWalletRole: PublicKey;
  let walletsAdminWalletRole: PublicKey;
  let transferAdminWalletRole: PublicKey;
  const recipient = new Keypair();
  let recipientTokenAccount: PublicKey;
  const target = new Keypair();
  let targetTokenAccount: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setup();

    [reserveAdminWalletRole] = testEnvironment.accessControlHelper.walletRolePDA(testEnvironment.reserveAdmin.publicKey);
    [walletsAdminWalletRole] = testEnvironment.accessControlHelper.walletRolePDA(testEnvironment.walletsAdmin.publicKey);
    [transferAdminWalletRole] = testEnvironment.accessControlHelper.walletRolePDA(testEnvironment.transferAdmin.publicKey);
    recipientTokenAccount = await testEnvironment.mintHelper.createAssociatedTokenAccount(
      recipient.publicKey,
      testEnvironment.contractAdmin,
    );
    targetTokenAccount = await testEnvironment.mintHelper.createAssociatedTokenAccount(
      target.publicKey,
      testEnvironment.contractAdmin,
    );
  });

  // it("fails to mint more than maxTotalSupply", async () => {
  //   const { maxTotalSupply: maxTotalSupply } = await testEnvironment.accessControlHelper.accessControlData();

  //   const amount = maxTotalSupply.sub(new anchor.BN(testEnvironmentParams.initialSupply)).addn(1);
  //   try {
  //     await testEnvironment.accessControlHelper.mintSecurities(
  //       amount,
  //       recipient.publicKey,
  //       recipientTokenAccount,
  //       testEnvironment.reserveAdmin,
  //     );
  //     assert.fail("Expected an error");
  //   } catch ({ error }) {
  //     assert.equal(error.errorCode.code, "MintExceedsMaxTotalSupply");
  //     assert.equal(error.errorMessage, "Cannot mint more than max total supply");
  //   }
  // });

  it("fails when transfer hook data is not initialized", async () => {
    const amount = 1_000_000;
    try {
      await testEnvironment.accessControlHelper.forceTransferBetween(
        amount,
        target.publicKey,
        targetTokenAccount,
        recipient.publicKey,
        recipientTokenAccount,
        testEnvironment.contractAdmin,
        testEnvironment.connection,
      );
      assert.fail("Expected an error");
    } catch (error) {
      assert.instanceOf(error, TokenTransferHookAccountDataNotFound);
    }
  });

  const targetHolderId = 0;
  const recipientHolderId = 1;
  const groupId = 1;
  let groupPubkey: PublicKey;
  let targetHolderPubkey: PublicKey;
  let recipientHolderPubkey: PublicKey;
  let targetHolderGroupPubkey: PublicKey;
  let recipientHolderGroupPubkey: PublicKey;
  it("initialize transfer hook data", async () => {
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(targetHolderId),
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin,
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(recipientHolderId),
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin,
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      new anchor.BN(groupId),
      transferAdminWalletRole,
      testEnvironment.transferAdmin,
    );
    [targetHolderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(new anchor.BN(targetHolderId));
    [recipientHolderPubkey] = testEnvironment.transferRestrictionsHelper.holderPDA(new anchor.BN(recipientHolderId));
    [groupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(new anchor.BN(groupId));
    [targetHolderGroupPubkey] = testEnvironment.transferRestrictionsHelper.holderGroupPDA(targetHolderPubkey, new anchor.BN(groupId));
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      targetHolderGroupPubkey,
      targetHolderPubkey,
      groupPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin,
    );
    [recipientHolderGroupPubkey] = testEnvironment.transferRestrictionsHelper.holderGroupPDA(recipientHolderPubkey, new anchor.BN(groupId));
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      recipientHolderGroupPubkey,
      recipientHolderPubkey,
      groupPubkey,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin,
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      targetHolderPubkey,
      targetHolderGroupPubkey,
      target.publicKey,
      targetTokenAccount,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin,
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      groupPubkey,
      recipientHolderPubkey,
      recipientHolderGroupPubkey,
      recipient.publicKey,
      recipientTokenAccount,
      walletsAdminWalletRole,
      testEnvironment.walletsAdmin,
    );
  });

  const unauthorizedErrorMsg = "Program log: AnchorError occurred. Error Code: Unauthorized. Error Number: 6000. Error Message: Unauthorized.";
  const amount = 1_000_000;
  it("does not allow forceTransferBetween for contract admin", async () => {
    try {
      await testEnvironment.accessControlHelper.forceTransferBetween(
        amount,
        target.publicKey,
        targetTokenAccount,
        recipient.publicKey,
        recipientTokenAccount,
        testEnvironment.contractAdmin,
        testEnvironment.connection,
      );
      assert.fail("Expected an error");
    } catch (error) {
      error.logs.some((log: string) => log === unauthorizedErrorMsg);
    }
  });

  it("does not allow forceTransferBetween for wallets admin", async () => {
    try {
      await testEnvironment.accessControlHelper.forceTransferBetween(
        amount,
        target.publicKey,
        targetTokenAccount,
        recipient.publicKey,
        recipientTokenAccount,
        testEnvironment.walletsAdmin,
        testEnvironment.connection,
      );
      assert.fail("Expected an error");
    } catch (error) {
      error.logs.some((log: string) => log === unauthorizedErrorMsg);
    }
  });

  it("does not allow forceTransferBetween for transfer admin", async () => {
    try {
      await testEnvironment.accessControlHelper.forceTransferBetween(
        amount,
        target.publicKey,
        targetTokenAccount,
        recipient.publicKey,
        recipientTokenAccount,
        testEnvironment.transferAdmin,
        testEnvironment.connection,
      );
      assert.fail("Expected an error");
    } catch (error) {
      error.logs.some((log: string) => log === unauthorizedErrorMsg);
    }
  });

  it("fails when target account does not have enough balance", async () => {
    try {
      await testEnvironment.accessControlHelper.forceTransferBetween(
        1_000_000,
        target.publicKey,
        targetTokenAccount,
        recipient.publicKey,
        recipientTokenAccount,
        testEnvironment.reserveAdmin,
        testEnvironment.connection,
      );
      assert.fail("Expected an error");
    } catch (error) {
      assert.equal(error, "Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 1: custom program error: 0x1");
    }
  });

  it("force transfer between 2 wallets by reserve admin", async () => {
    await testEnvironment.accessControlHelper.mintSecurities(
      new anchor.BN(amount),
      target.publicKey,
      targetTokenAccount,
      testEnvironment.reserveAdmin
    );
    let {
      amount: targetAmountBefore
    } = await testEnvironment.mintHelper.getAccount(targetTokenAccount);
    let {
      amount: recipientAmountBefore
    } = await testEnvironment.mintHelper.getAccount(recipientTokenAccount);
    await testEnvironment.accessControlHelper.forceTransferBetween(
      1_000_000,
      target.publicKey,
      targetTokenAccount,
      recipient.publicKey,
      recipientTokenAccount,
      testEnvironment.reserveAdmin,
      testEnvironment.connection,
    );
    let { 
      amount: targetAmountAfter
    } = await testEnvironment.mintHelper.getAccount(targetTokenAccount);
    let { 
      amount: recipientAmountAfter
    } = await testEnvironment.mintHelper.getAccount(recipientTokenAccount);
    assert.equal(targetAmountBefore - targetAmountAfter, BigInt(amount));
    assert.equal(recipientAmountAfter - recipientAmountBefore, BigInt(amount));
  });
});
