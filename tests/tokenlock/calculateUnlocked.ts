import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair } from "@solana/web3.js";

import { Tokenlock } from "../../target/types/tokenlock";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "./../helpers/test_environment";
import { createAccount, solToLamports, topUpWallet } from "./../utils";
import {
  createReleaseSchedule,
  initializeTokenlock,
  getReleaseSchedule,
  calculateUnlocked,
  getTokenlockAccount,
  MAX_RELEASE_DELAY,
} from "./../helpers/tokenlock_helper";
import { fromDaysToSeconds, fromMonthsToSeconds } from "../helpers/datetime";

describe("TokenLockup calculate unlocked", () => {
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
  let escrowAccount: anchor.web3.PublicKey;
  let escrowOwnerPubkey: anchor.web3.PublicKey;
  let tokenlockWallet: anchor.web3.Keypair;
  let tokenlockDataPubkey: anchor.web3.PublicKey;
  let reserveAdmin: anchor.web3.Keypair;
  let reserveAdminWalletRolePubkey: anchor.web3.PublicKey;

  beforeEach(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.mintToReserveAdmin();

    // create wallet A
    walletA = Keypair.generate();
    mintPubkey = testEnvironment.mintKeypair.publicKey;
    reserveAdmin = testEnvironment.reserveAdmin;
    [reserveAdminWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(reserveAdmin.publicKey);

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
    const maxReleaseDelay = new anchor.BN(MAX_RELEASE_DELAY);
    const minTimelockAmount = new anchor.BN(100);
    await initializeTokenlock(
      tokenlockProgram,
      maxReleaseDelay,
      minTimelockAmount,
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
  });

  describe("simple no delay 2 period 50/50", () => {
    let scheduleId;
    const commenced = 0;
    const amount = 100;

    beforeEach(async () => {
      scheduleId = await createReleaseSchedule(
        tokenlockProgram,
        tokenlockDataPubkey,
        2,
        new anchor.BN(0),
        5000,
        new anchor.BN(1),
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRolePubkey,
        reserveAdmin
      );
    });

    it("50% unlocked at start", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );

      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced;
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        new anchor.BN(amount),
        schedule
      );
      assert.equal(unlocked.toNumber(), 50);
    });

    it("100% unlocked after first batch bips", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromMonthsToSeconds(1);
      const unlockedAtStart = calculateUnlocked(
        commenced,
        currentTime,
        new anchor.BN(amount),
        schedule
      );
      assert.equal(unlockedAtStart.toNumber(), 100);
    });
  });

  describe("simple 1 month delay then 2 period 50/50", () => {
    let scheduleId;
    const commenced = 0;
    const amount = new anchor.BN(100);

    beforeEach(async () => {
      scheduleId = await createReleaseSchedule(
        tokenlockProgram,
        tokenlockDataPubkey,
        2,
        new anchor.BN(fromMonthsToSeconds(1)),
        5000,
        new anchor.BN(fromMonthsToSeconds(1)),
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRolePubkey,
        reserveAdmin
      );
    });

    it("0% unlocked at start", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced;
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert.equal(unlocked.toNumber(), 0);
    });

    it("0% unlocked 1 second before the initial delay has elapsed", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromMonthsToSeconds(1) - 1;
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert.equal(unlocked.toNumber(), 0);
    });

    it("50% unlocked after 1 month", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, Number(scheduleId));
      const currentTime = commenced + fromMonthsToSeconds(1);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert.equal(unlocked.toNumber(), 50);
    });

    it("50% unlocked 1 second before the 2nd final period has elapsed", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromMonthsToSeconds(2) - 1;
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert.equal(unlocked.toNumber(), 50);
    });

    it("100% unlocked after 2 months", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromMonthsToSeconds(2);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert.equal(unlocked.toNumber(), 100);
    });
  });

  describe("8% released immediately and remainder released in equal amounts every 90 days for 270 days.", () => {
    let scheduleId;
    const commenced = 0;
    const amount = new anchor.BN(100);

    beforeEach(async () => {
      scheduleId = await createReleaseSchedule(
        tokenlockProgram,
        tokenlockDataPubkey,
        4,
        new anchor.BN(0),
        800,
        new anchor.BN(fromDaysToSeconds(90)),
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRolePubkey,
        reserveAdmin
      );
    });

    it("8% unlocked at start", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced;
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(unlocked.toNumber() === 8);
    });

    it("30 + 8 unlocked after 90 days", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromMonthsToSeconds(3);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 38);
    });

    it("60 + 9 unlocked after 180 days", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromMonthsToSeconds(6);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 69);
    });

    it("90 + 8 + remainder = 100 unlocked after 180 days", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromMonthsToSeconds(9);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 100);
    });
  });

  describe("7.7% released immediately and remainder released in equal amounts every 90 days for 360 days", () => {
    let scheduleId: number | string;
    const commenced = 0;
    const amount = new anchor.BN(1000);

    beforeEach(async () => {
      scheduleId = await createReleaseSchedule(
        tokenlockProgram,
        tokenlockDataPubkey,
        5,
        new anchor.BN(0),
        770,
        new anchor.BN(fromMonthsToSeconds(3)),
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRolePubkey,
        reserveAdmin
      );
    });

    it("77 = 7.7% = 770 bips unlocked at start", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, Number(scheduleId));
      const currentTime = commenced;
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(unlocked.toNumber() === 77);
    });

    it("307 = 77 + 230 // truncate((923x1)/4) unlocked after one 90 day period", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, Number(scheduleId));
      const currentTime = commenced + fromMonthsToSeconds(3);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 307);
    });

    it("538 = 77 +  461 // truncate((923x2)/4) periods unlocked after 180 days", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, Number(scheduleId));
      const currentTime = commenced + fromMonthsToSeconds(6);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 538);
    });

    it("769 = 77 + 692 // truncate((923x3)/4) unlocked after 270 days", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, Number(scheduleId));
      const currentTime = commenced + fromMonthsToSeconds(9);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 769);
    });

    it("1000 = 77 + 923 * truncate((923x4)/4) unlocked after 360 days", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, Number(scheduleId));
      const currentTime = commenced + fromMonthsToSeconds(12);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(unlocked.toNumber() === 1000);
    });
  });

  describe("7.2% released immediately and remainder released in equal amounts every 90 days for 540 days (6 quarters)", () => {
    let scheduleId;
    const commenced = 0;
    const amount = new anchor.BN(1000);

    beforeEach(async () => {
      scheduleId = await createReleaseSchedule(
        tokenlockProgram,
        tokenlockDataPubkey,
        7,
        new anchor.BN(0),
        720,
        new anchor.BN(fromDaysToSeconds(90)),
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRolePubkey,
        reserveAdmin
      );
    });

    it("72 = 7.2% = 720 bips unlocked at start", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced;
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(unlocked.toNumber() === 72);
    });

    it("226 = 72 + 154(truncated period portion) unlocked after one 90 day period", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromDaysToSeconds(90);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );

      assert(Math.trunc(unlocked.toNumber()) === 226);
    });

    it("381 = 72 + 309 periods unlocked after 180 days", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromDaysToSeconds(180);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 381);
    });

    it("536 = 72 + 464 periods unlocked after 270 days", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromDaysToSeconds(270);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 536);
    });

    it("688 = 72 + 618 periods unlocked after 360 days", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromDaysToSeconds(360);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 690);
    });

    it("845 = 72 + 773 periods unlocked after 450 days", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromDaysToSeconds(450);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 845);
    });

    it("1000 = 72 + 154 * 6 periods + 4 (remainder) unlocked after 540 days", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced + fromDaysToSeconds(540);
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 1000);
    });
  });

  describe("continuous vesting per second", async () => {
    let scheduleId;
    const commenced = 0;
    const numberOfSecondsInYear = 365 * 24 * 60 * 60; // 31,536,000
    let amount = new anchor.BN(numberOfSecondsInYear); // 1 token per second

    beforeEach(async () => {
      scheduleId = await createReleaseSchedule(
        tokenlockProgram,
        tokenlockDataPubkey,
        numberOfSecondsInYear,
        new anchor.BN(0),
        0,
        new anchor.BN(1),
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRolePubkey,
        reserveAdmin
      );
    });

    it("0 unlocked at start", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      const currentTime = commenced;
      const unlocked = calculateUnlocked(
        commenced,
        currentTime,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === 0);
    });

    it("1 token unlocked each second for 1 year (365 days)", async () => {
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);
      let unlocked = calculateUnlocked(commenced, 1, amount, schedule);
      assert(Math.trunc(unlocked.toNumber()) === 1);

      unlocked = calculateUnlocked(commenced, 1e6, amount, schedule);
      assert(Math.trunc(unlocked.toNumber()) === 1e6);

      unlocked = calculateUnlocked(commenced, 31536000, amount, schedule);
      assert(Math.trunc(unlocked.toNumber()) === 31536000);

      unlocked = calculateUnlocked(
        commenced,
        numberOfSecondsInYear,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === numberOfSecondsInYear);

      unlocked = calculateUnlocked(
        commenced,
        numberOfSecondsInYear + 1,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === numberOfSecondsInYear);
    });

    it("remainder of tokens delivered as evenly as possible if amount = 2 x numberOfPeriods - 10", async () => {
      // the formula should do truncate((amount + elapsedPeriods) / periods)
      // instead of truncate(amount / periods) * elapsed periods
      // this by delaying truncation this distributes tokens more evenly accross the time periods
      // the more time periods, the more these accumulations add up
      // this is most dramatic for distributions calculated every seconds for millions of seconds
      const account = await getTokenlockAccount(
        tokenlockProgram,
        tokenlockDataPubkey
      );
      const schedule = getReleaseSchedule(account, scheduleId);

      amount = new anchor.BN(numberOfSecondsInYear * 2 - 10);
      let unlocked = calculateUnlocked(commenced, 1, amount, schedule);
      assert(Math.trunc(unlocked.toNumber()) === 1);

      // third period is where even distributions starts accumulating differently
      // than if we divided all periods first then multiplied
      unlocked = calculateUnlocked(commenced, 3, amount, schedule);
      assert(Math.trunc(unlocked.toNumber()) === 5);

      unlocked = calculateUnlocked(commenced, 10, amount, schedule);
      assert(Math.trunc(unlocked.toNumber()) === 19);

      unlocked = calculateUnlocked(commenced, 100, amount, schedule);
      assert(Math.trunc(unlocked.toNumber()) === 199);

      // at 1M seconds the difference in what is distributed using this method is double - 1. Very significant.
      unlocked = calculateUnlocked(commenced, 1e6, amount, schedule);
      assert(Math.trunc(unlocked.toNumber()) === 1999999);

      unlocked = calculateUnlocked(
        commenced,
        numberOfSecondsInYear,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === amount.toNumber());

      unlocked = calculateUnlocked(
        commenced,
        numberOfSecondsInYear + 1,
        amount,
        schedule
      );
      assert(Math.trunc(unlocked.toNumber()) === amount.toNumber());
    });
  });
});
