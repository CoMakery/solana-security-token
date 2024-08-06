import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Set holder group max", () => {
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
  let groupPubkey: PublicKey;

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
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      firstGroupIdx,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );
    [groupPubkey] = testEnvironment.transferRestrictionsHelper.groupPDA(firstGroupIdx);

  });

  it("fails to set holder group max by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const maxHolders = new anchor.BN(10);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setHolderGroupMax(maxHolders)
        .accountsStrict({
          transferRestrictionData: testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey,
          accessControlAccount: testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          group: groupPubkey,
          payer: signer.publicKey,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to set holder group max by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const maxHolders = new anchor.BN(10);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setHolderGroupMax(maxHolders)
        .accountsStrict({
          transferRestrictionData: testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey,
          accessControlAccount: testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          group: groupPubkey,
          payer: signer.publicKey,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to set holder group max by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const maxHolders = new anchor.BN(10);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setHolderGroupMax(maxHolders)
        .accountsStrict({
          transferRestrictionData: testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey,
          accessControlAccount: testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          group: groupPubkey,
          payer: signer.publicKey,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("sets holder group max by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const maxHolders = new anchor.BN(10);
    await testEnvironment.transferRestrictionsHelper.program.methods
      .setHolderGroupMax(maxHolders)
      .accountsStrict({
        transferRestrictionData: testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey,
        accessControlAccount: testEnvironment.accessControlHelper.accessControlPubkey,
        mint: testEnvironment.mintKeypair.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        group: groupPubkey,
        payer: signer.publicKey,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const groupData = await testEnvironment.transferRestrictionsHelper.groupData(groupPubkey);
    assert.equal(groupData.maxHolders.toNumber(), maxHolders.toNumber());
  });
});
