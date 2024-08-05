import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { SystemProgram } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Initialize transfer restriction Holder", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://e.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 2,
  };
  let testEnvironment: TestEnvironment;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
  });

  const zeroHolderIdx = new anchor.BN(0);
  it("fails to initialize holder by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroHolderIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionHolder(zeroHolderIdx)
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          payer: signer.publicKey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to initialize holder by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroHolderIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionHolder(zeroHolderIdx)
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          payer: signer.publicKey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to initialize holder with index greater than allowed", async () => {
    const signer = testEnvironment.transferAdmin;
    const trData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const holderIdx = trData.holderIds.addn(1);
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionHolder(holderIdx)
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          payer: signer.publicKey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "InvalidHolderIndex");
      assert.equal(
        error.errorMessage,
        "Invalid transfer restriction holder index"
      );
    }
  });

  it("initializes holder by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroHolderIdx);
    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRestrictionHolder(zeroHolderIdx)
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        payer: signer.publicKey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const holderData =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.isTrue(holderData.active);
    assert.equal(holderData.id.toString(), zeroHolderIdx.toString());
    assert.equal(holderData.currentWalletsCount.toNumber(), 0);
    assert.equal(
      holderData.transferRestrictionData.toString(),
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toString()
    );
    const trData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(trData.currentHoldersCount.toNumber(), 1);
    assert.equal(trData.holderIds.toNumber(), 1);
  });

  const firstHolderIdx = new anchor.BN(1);
  it("initializes holder by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(firstHolderIdx);
    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRestrictionHolder(firstHolderIdx)
      .accountsStrict({
        transferRestrictionHolder: holderPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        payer: signer.publicKey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const holderData =
      await testEnvironment.transferRestrictionsHelper.holderData(holderPubkey);
    assert.isTrue(holderData.active);
    assert.equal(holderData.id.toString(), firstHolderIdx.toString());
    assert.equal(holderData.currentWalletsCount.toNumber(), 0);
    assert.equal(
      holderData.transferRestrictionData.toString(),
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toString()
    );
    const trData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(trData.currentHoldersCount.toNumber(), 2);
    assert.equal(trData.holderIds.toNumber(), 2);
  });

  it("fails to initialize holder when max holders reached", async () => {
    const signer = testEnvironment.transferAdmin;
    const trData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    const holderIdx = trData.holderIds;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionHolder(holderIdx)
        .accountsStrict({
          transferRestrictionHolder: holderPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          payer: signer.publicKey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "MaxHoldersReached");
      assert.equal(error.errorMessage, "Max holders reached");
    }
  });
});
