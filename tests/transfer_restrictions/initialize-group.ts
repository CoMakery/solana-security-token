import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { SystemProgram } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Initialize transfer restriction Group", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://example.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 3,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;
  const firstGroupIdx = new anchor.BN(1);

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
  });

  it("fails to initialize group by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionGroup(firstGroupIdx)
        .accountsStrict({
          transferRestrictionGroup: groupPubkey,
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

  it("fails to initialize group by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionGroup(firstGroupIdx)
        .accountsStrict({
          transferRestrictionGroup: groupPubkey,
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

  it("fails to initialize group by wallets admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionGroup(firstGroupIdx)
        .accountsStrict({
          transferRestrictionGroup: groupPubkey,
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

  it("fails to initializes when wrong group id is provided", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionGroup(new anchor.BN(0))
        .accountsStrict({
          transferRestrictionGroup: groupPubkey,
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
      assert.equal(error.errorCode.code, "ConstraintSeeds");
      assert.equal(error.errorMessage, "A seeds constraint was violated");
    }
  });

  it("initializes transfer restriction group by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const groupIdx = new anchor.BN(10);
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupIdx);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRestrictionGroup(groupIdx)
      .accountsStrict({
        transferRestrictionGroup: groupPubkey,
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

    const group = await testEnvironment.transferRestrictionsHelper.groupData(
      groupPubkey
    );
    assert.equal(group.id.toNumber(), groupIdx.toNumber());
    assert.equal(group.currentHoldersCount.toNumber(), 0);
    assert.equal(group.maxHolders.toNumber(), 0);
    assert.equal(
      group.transferRestrictionData.toString(),
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toString()
    );
  });
});
