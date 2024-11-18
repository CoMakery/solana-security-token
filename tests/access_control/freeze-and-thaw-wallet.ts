import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { Tokenlock } from "../../target/types/tokenlock";
import { createAccount, solToLamports, topUpWallet } from "../utils";
import {
  initializeTokenlock,
  MAX_RELEASE_DELAY,
} from "../helpers/tokenlock_helper";

describe("Access Control freeze wallet", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://example.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 10000,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.mintToReserveAdmin();
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

  describe("when token lockup escrow account ", () => {
    const tokenlockProgram = anchor.workspace
      .Tokenlock as anchor.Program<Tokenlock>;
    let tokenlockDataPubkey: anchor.web3.PublicKey;
    let escrowAccount: anchor.web3.PublicKey;
    let escrowOwnerPubkey: anchor.web3.PublicKey;
    before(async () => {
      await topUpWallet(
        testEnvironment.connection,
        testEnvironment.contractAdmin.publicKey,
        solToLamports(10)
      );
      const space = 1 * 1024 * 1024; // 1MB

      tokenlockDataPubkey = await createAccount(
        testEnvironment.connection,
        testEnvironment.contractAdmin,
        space,
        tokenlockProgram.programId
      );
      [escrowOwnerPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("tokenlock"),
          testEnvironment.mintKeypair.publicKey.toBuffer(),
          tokenlockDataPubkey.toBuffer(),
        ],
        tokenlockProgram.programId
      );
      escrowAccount =
        await testEnvironment.mintHelper.createAssociatedTokenAccount(
          escrowOwnerPubkey,
          testEnvironment.contractAdmin,
          true
        );
      const maxReleaseDelay = new anchor.BN(MAX_RELEASE_DELAY);
      const minTimelockAmount = new anchor.BN(100);
      await initializeTokenlock(
        tokenlockProgram,
        maxReleaseDelay,
        minTimelockAmount,
        tokenlockDataPubkey,
        escrowAccount,
        testEnvironment.transferRestrictionsHelper
          .transferRestrictionDataPubkey,
        testEnvironment.mintKeypair.publicKey,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.contractAdmin.publicKey
        )[0],
        testEnvironment.accessControlHelper.accessControlPubkey,
        testEnvironment.contractAdmin
      );

      await testEnvironment.accessControlHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        testEnvironment.contractAdmin
      );

      const accessControlData =
        await testEnvironment.accessControlHelper.accessControlData();
    });

    it("does not allow freeze token lockup escrow account ", async () => {
      try {
        await testEnvironment.accessControlHelper.freezeWallet(
          escrowOwnerPubkey,
          escrowAccount,
          testEnvironment.transferAdmin
        );
        assert.fail("Expected an error");
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "CannotFreezeLockupEscrowAccount");
        assert.equal(error.errorMessage, "Cannot freeze lockup escrow account");
      }
    });
  });
});
