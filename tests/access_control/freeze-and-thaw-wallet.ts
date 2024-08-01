import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { solToLamports, topUpWallet } from "../utils";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

describe("Access Control freeze wallet", () => {
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

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setup();
  });

  const target = new Keypair();
  let targetTokenAccount: PublicKey;
  it("does not allow freezing by contract admin", async () => {
    targetTokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        target.publicKey,
        testEnvironment.contractAdmin
      );
    try {
      await testEnvironment.accessControlHelper.freezeWallet(
        target.publicKey,
        targetTokenAccount,
        testEnvironment.contractAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("does not allow freezing by reserve admin", async () => {
    try {
      await testEnvironment.accessControlHelper.freezeWallet(
        target.publicKey,
        targetTokenAccount,
        testEnvironment.reserveAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("freezes wallet by wallets admin", async () => {
    await testEnvironment.accessControlHelper.freezeWallet(
      target.publicKey,
      targetTokenAccount,
      testEnvironment.walletsAdmin
    );
    const targetTokenAccountData = await testEnvironment.mintHelper.getAccount(
      targetTokenAccount
    );
    assert.isTrue(targetTokenAccountData.isFrozen);
  });

  it("does not allow thawing wallets by contract admin", async () => {
    try {
      await testEnvironment.accessControlHelper.thawWallet(
        target.publicKey,
        targetTokenAccount,
        testEnvironment.contractAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("does not allow thawing wallets by reserve admin", async () => {
    try {
      await testEnvironment.accessControlHelper.thawWallet(
        target.publicKey,
        targetTokenAccount,
        testEnvironment.reserveAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  const target2 = new Keypair();
  let target2TokenAccount: PublicKey;
  it("freezes wallet by transfer admin", async () => {
    target2TokenAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        target2.publicKey,
        testEnvironment.contractAdmin
      );
    await testEnvironment.accessControlHelper.freezeWallet(
      target2.publicKey,
      target2TokenAccount,
      testEnvironment.transferAdmin
    );
    const targetTokenAccountData = await testEnvironment.mintHelper.getAccount(
      target2TokenAccount
    );
    assert.isTrue(targetTokenAccountData.isFrozen);
  });

  it("thaws wallet by wallets admin", async () => {
    await testEnvironment.accessControlHelper.thawWallet(
      target.publicKey,
      targetTokenAccount,
      testEnvironment.walletsAdmin
    );
    const targetTokenAccountData = await testEnvironment.mintHelper.getAccount(
      targetTokenAccount
    );
    assert.isFalse(targetTokenAccountData.isFrozen);
  });

  it("thaws wallet by transfer admin", async () => {
    await testEnvironment.accessControlHelper.thawWallet(
      target2.publicKey,
      target2TokenAccount,
      testEnvironment.transferAdmin
    );
    const targetTokenAccountData = await testEnvironment.mintHelper.getAccount(
      target2TokenAccount
    );
    assert.isFalse(targetTokenAccountData.isFrozen);
  });
});
