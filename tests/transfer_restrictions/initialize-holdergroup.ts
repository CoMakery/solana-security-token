import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { SystemProgram } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Initialize transfer restriction HolderGroup", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://e.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 3,
  };
  let testEnvironment: TestEnvironment;
  const zeroIdx = new anchor.BN(0);
  const firstGroupIdx = new anchor.BN(1);
  const maxHoldersInGroup1 = new anchor.BN(1);

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      zeroIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(1),
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      new anchor.BN(2),
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      firstGroupIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );

    const [firstGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    await testEnvironment.transferRestrictionsHelper.setHolderGroupMax(
      maxHoldersInGroup1,
      firstGroupPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
  });

  it("fails to initialize holdergroup by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroIdx);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(zeroIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        zeroIdx
      );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeHolderGroup()
        .accountsStrict({
          holderGroup: holderGroupPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
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

  it("fails to initialize holdergroup by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroIdx);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(zeroIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        zeroIdx
      );

    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeHolderGroup()
        .accountsStrict({
          holderGroup: holderGroupPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
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

  it("initialize holdergroup by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(zeroIdx);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(zeroIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        zeroIdx
      );
    const { currentHoldersCount: holderGroupCountBefore } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeHolderGroup()
      .accountsStrict({
        holderGroup: holderGroupPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const holderGroup =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupPubkey
      );
    assert.equal(holderGroup.holder.toString(), holderPubkey.toString());
    assert.equal(holderGroup.group.toString(), zeroIdx.toString());
    assert.equal(holderGroup.currentWalletsCount.toNumber(), 0);

    const { currentHoldersCount: holderGroupCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
    assert.equal(
      holderGroupCountAfter.toNumber(),
      holderGroupCountBefore.toNumber()
    );
  });

  it("initialize holdergroup by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const holderIdx = firstGroupIdx;
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );
    const { currentHoldersCount: holderGroupCountBefore } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeHolderGroup()
      .accountsStrict({
        holderGroup: holderGroupPubkey,
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        group: groupPubkey,
        holder: holderPubkey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });

    const holderGroup =
      await testEnvironment.transferRestrictionsHelper.holderGroupData(
        holderGroupPubkey
      );
    assert.equal(holderGroup.holder.toString(), holderPubkey.toString());
    assert.equal(holderGroup.group.toString(), firstGroupIdx.toString());
    assert.equal(holderGroup.currentWalletsCount.toNumber(), 0);

    const { currentHoldersCount: holderGroupCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
    assert.equal(
      holderGroupCountAfter.toNumber(),
      holderGroupCountBefore.toNumber()
    );
  });

  it("fails to initialize holdergroup when max holders reached inside the group", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const holderIdx = new anchor.BN(2);
    const [holderPubkey] =
      testEnvironment.transferRestrictionsHelper.holderPDA(holderIdx);
    const [groupPubkey] =
      testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);
    const [holderGroupPubkey] =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        holderPubkey,
        firstGroupIdx
      );

    const { currentHoldersCount: holderGroupCountBefore } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeHolderGroup()
        .accountsStrict({
          holderGroup: holderGroupPubkey,
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          group: groupPubkey,
          holder: holderPubkey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "MaxHoldersReachedInsideTheGroup");
      assert.equal(error.errorMessage, "Max holders reached inside the group");
    }
    const { currentHoldersCount: holderGroupCountAfter } =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
    assert.equal(
      holderGroupCountAfter.toNumber(),
      holderGroupCountBefore.toNumber()
    );
  });
});
