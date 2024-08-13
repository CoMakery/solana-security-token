import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";

describe("Set holder max", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://e.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 3,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
  });

  it("fails to set holder max by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const maxHolders = new anchor.BN(10);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setHolderMax(maxHolders)
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
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

  it("fails to set holder max by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const maxHolders = new anchor.BN(10);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setHolderMax(maxHolders)
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
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

  it("fails to set holder max by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const maxHolders = new anchor.BN(10);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .setHolderMax(maxHolders)
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
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

  it("sets holder max by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const maxHolders = new anchor.BN(777);

    await testEnvironment.transferRestrictionsHelper.program.methods
      .setHolderMax(maxHolders)
      .accountsStrict({
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        mint: testEnvironment.mintKeypair.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: signer.publicKey,
      })
      .signers([signer])
      .rpc({ commitment: testEnvironment.commitment });
    const groupData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(groupData.maxHolders.toNumber(), maxHolders.toNumber());
  });

  describe("when current holders count is greater than new max holders", () => {
    before(async () => {
      let { holderIds: currentHolderIndex } =
        await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
      const newHoldersCount = 2;
      for (let i = 0; i < newHoldersCount; i++) {
        await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
          currentHolderIndex,
          testEnvironment.accessControlHelper.walletRolePDA(
            testEnvironment.walletsAdmin.publicKey
          )[0],
          testEnvironment.walletsAdmin
        );
        currentHolderIndex = currentHolderIndex.addn(1);
      }
    });

    it("fails to set holder max", async () => {
      const signer = testEnvironment.transferAdmin;
      const [authorityWalletRolePubkey] =
        testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
      let { currentHoldersCount: currentHoldersCount } =
        await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
      const maxHolders = currentHoldersCount.subn(1);

      try {
        await testEnvironment.transferRestrictionsHelper.program.methods
          .setHolderMax(maxHolders)
          .accountsStrict({
            transferRestrictionData:
              testEnvironment.transferRestrictionsHelper
                .transferRestrictionDataPubkey,
            accessControlAccount:
              testEnvironment.accessControlHelper.accessControlPubkey,
            mint: testEnvironment.mintKeypair.publicKey,
            authorityWalletRole: authorityWalletRolePubkey,
            payer: signer.publicKey,
          })
          .signers([signer])
          .rpc({ commitment: testEnvironment.commitment });
        assert.fail("Expect an error");
      } catch ({ error }) {
        assert.equal(
          error.errorCode.code,
          "NewHolderMaxMustExceedCurrentHolderCount"
        );
        assert.equal(
          error.errorMessage,
          "New holder max must exceed current holder count"
        );
      }
    });
  });
});
