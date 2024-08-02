import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { solToLamports, topUpWallet } from "../utils";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Roles } from "../helpers/access-control_helper";

describe("Access Control wallet role", () => {
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

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setup();

    [reserveAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.reserveAdmin.publicKey
      );
  });

  const investor = new Keypair();
  it("fails to initialize wallet role by reserve admin", async () => {
    try {
      await testEnvironment.accessControlHelper.initializeWalletRole(
        investor.publicKey,
        Roles.WalletsAdmin,
        testEnvironment.reserveAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to initialize wallet role by wallets admin", async () => {
    try {
      await testEnvironment.accessControlHelper.initializeWalletRole(
        investor.publicKey,
        Roles.WalletsAdmin,
        testEnvironment.walletsAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to initialize wallet role by transfer admin", async () => {
    try {
      await testEnvironment.accessControlHelper.initializeWalletRole(
        investor.publicKey,
        Roles.WalletsAdmin,
        testEnvironment.transferAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to initialize invalid wallet role", async () => {
    try {
      await testEnvironment.accessControlHelper.initializeWalletRole(
        investor.publicKey,
        Roles.All + 1,
        testEnvironment.contractAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "InvalidRole");
      assert.equal(error.errorMessage, "Invalid role");
    }
  });

  it("initializes wallet role by contract admin", async () => {
    await testEnvironment.accessControlHelper.initializeWalletRole(
      investor.publicKey,
      Roles.WalletsAdmin,
      testEnvironment.contractAdmin
    );

    const [walletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(investor.publicKey);
    const walletRoleData =
      await testEnvironment.accessControlHelper.walletRoleData(
        walletRolePubkey
      );
    assert.equal(walletRoleData.role, Roles.WalletsAdmin);
    assert.strictEqual(
      walletRoleData.owner.toString(),
      investor.publicKey.toString()
    );
    assert.strictEqual(
      walletRoleData.accessControl.toString(),
      testEnvironment.accessControlHelper.accessControlPubkey.toString()
    );
  });

  it("fails to update wallet role by reserve admin", async () => {
    try {
      await testEnvironment.accessControlHelper.updateWalletRole(
        investor.publicKey,
        Roles.TransferAdmin,
        testEnvironment.reserveAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to update wallet role by wallets admin", async () => {
    try {
      await testEnvironment.accessControlHelper.updateWalletRole(
        investor.publicKey,
        Roles.TransferAdmin,
        testEnvironment.walletsAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to update wallet role by transfer admin", async () => {
    try {
      await testEnvironment.accessControlHelper.updateWalletRole(
        investor.publicKey,
        Roles.TransferAdmin,
        testEnvironment.transferAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("updates wallet role by contract admin", async () => {
    await testEnvironment.accessControlHelper.updateWalletRole(
      investor.publicKey,
      Roles.TransferAdmin,
      testEnvironment.contractAdmin
    );

    const [walletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(investor.publicKey);
    const walletRoleData =
      await testEnvironment.accessControlHelper.walletRoleData(
        walletRolePubkey
      );
    assert.equal(walletRoleData.role, Roles.TransferAdmin);
    assert.strictEqual(
      walletRoleData.owner.toString(),
      investor.publicKey.toString()
    );
    assert.strictEqual(
      walletRoleData.accessControl.toString(),
      testEnvironment.accessControlHelper.accessControlPubkey.toString()
    );
  });

  it("fails to update wallet role to invalid one", async () => {
    try {
      await testEnvironment.accessControlHelper.updateWalletRole(
        investor.publicKey,
        Roles.All + 1,
        testEnvironment.contractAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "InvalidRole");
      assert.equal(error.errorMessage, "Invalid role");
    }
  });
});
