import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair } from "@solana/web3.js";

import { Tokenlock } from "../../target/types/tokenlock";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { createAccount, solToLamports, topUpWallet } from "../utils";
import {
  initializeTokenlock,
  MAX_RELEASE_DELAY,
} from "../helpers/tokenlock_helper";

describe("TokenLockup initializeTokenlock tests", () => {
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

  const tokenlockProgram = anchor.workspace.Tokenlock as Program<Tokenlock>;

  let mintPubkey: anchor.web3.PublicKey;
  let walletA: anchor.web3.Keypair;
  let tokenlockWallet: anchor.web3.Keypair;
  let tokenlockDataPubkey: anchor.web3.PublicKey;
  let escrowAccount: anchor.web3.PublicKey;
  let escrowOwnerPubkey: anchor.web3.PublicKey;
  const minTimelockAmount = 484;

  beforeEach(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.mintToReserveAdmin();

    walletA = Keypair.generate();
    await topUpWallet(
      testEnvironment.connection,
      walletA.publicKey,
      solToLamports(1)
    );

    mintPubkey = testEnvironment.mintKeypair.publicKey;
    tokenlockWallet = anchor.web3.Keypair.generate();
    tokenlockDataPubkey = tokenlockWallet.publicKey;

    await topUpWallet(
      testEnvironment.connection,
      testEnvironment.contractAdmin.publicKey,
      solToLamports(100)
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
  });

  it("inject pretender wallet as escrow account", async () => {
    const space = 1 * 1024; // 1KB
    const tokenAccountPretender = await createAccount(
      testEnvironment.connection,
      testEnvironment.contractAdmin,
      space,
      tokenlockProgram.programId
    );

    try {
      await initializeTokenlock(
        tokenlockProgram,
        new anchor.BN(MAX_RELEASE_DELAY),
        new anchor.BN(minTimelockAmount),
        tokenAccountPretender,
        escrowAccount,
        testEnvironment.transferRestrictionsHelper
          .transferRestrictionDataPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.contractAdmin.publicKey
        )[0],
        testEnvironment.accessControlHelper.accessControlPubkey,
        testEnvironment.contractAdmin
      );
    } catch ({ error }) {
      assert.strictEqual(error.errorMessage, "Wrong escrow account");
      assert.strictEqual(error.errorCode.code, "IncorrectEscrowAccount");
      assert.strictEqual(error.errorCode.number, 6032);
    }
  });

  it("tokenlock successfully created", async () => {
    await initializeTokenlock(
      tokenlockProgram,
      new anchor.BN(MAX_RELEASE_DELAY),
      new anchor.BN(minTimelockAmount),
      tokenlockDataPubkey,
      escrowAccount,
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey,
      mintPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      )[0],
      testEnvironment.accessControlHelper.accessControlPubkey,
      testEnvironment.contractAdmin
    );

    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    assert.deepEqual(tokenlockData.escrowAccount, escrowAccount);
    assert.deepEqual(tokenlockData.mintAddress, mintPubkey);
    assert.equal(tokenlockData.releaseSchedules.length, 0);
    assert.equal(tokenlockData.maxReleaseDelay.toNumber(), MAX_RELEASE_DELAY);
    assert.equal(tokenlockData.minTimelockAmount.toNumber(), minTimelockAmount);
  });
});
