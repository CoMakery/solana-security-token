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
  fundReleaseSchedule,
  initializeTokenlock,
} from "./../helpers/tokenlock_helper";
import { getNowTs } from "./../helpers/clock_helper";
import { fromDaysToSeconds } from "../helpers/datetime";

describe("TokenLockup stress test", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://e.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 10000,
    minWalletBalance: 0,
  };
  let testEnvironment: TestEnvironment;
  const tokenlockProgram = anchor.workspace.Tokenlock as Program<Tokenlock>;

  let mintPubkey;
  let reserveAdmin;
  let walletB;
  let escrow;
  let pda;
  let walletC;
  let tokenlockAccount;
  let funderAcc;

  beforeEach(async () => {
    try {
      testEnvironment = new TestEnvironment(testEnvironmentParams);
      await testEnvironment.setup();

      walletB = Keypair.generate();
      walletC = Keypair.generate();

      mintPubkey = testEnvironment.mintKeypair.publicKey;
      reserveAdmin = testEnvironment.reserveAdmin;

      funderAcc = testEnvironment.mintHelper.getAssocciatedTokenAddress(
        testEnvironment.reserveAdmin.publicKey
      );
      await topUpWallet(
        testEnvironment.connection,
        testEnvironment.contractAdmin.publicKey,
        solToLamports(100)
      );
      const space = 1 * 1024 * 1024; // 1MB

      tokenlockAccount = await createAccount(
        testEnvironment.connection,
        testEnvironment.contractAdmin,
        space,
        tokenlockProgram.programId
      );
      const [escrowOwnerPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("tokenlock"),
          testEnvironment.mintKeypair.publicKey.toBuffer(),
          tokenlockAccount.toBuffer(),
        ],
        tokenlockProgram.programId
      );
      pda = escrowOwnerPubkey;
      escrow = await testEnvironment.mintHelper.createAssociatedTokenAccount(
        pda,
        testEnvironment.contractAdmin,
        true
      );
      const maxReleaseDelay = new anchor.BN(346896000);
      const minTimelockAmount = new anchor.BN(100);
      const initializeTokenlockSignature = await initializeTokenlock(
        tokenlockProgram,
        maxReleaseDelay,
        minTimelockAmount,
        tokenlockAccount,
        escrow,
        mintPubkey,
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.contractAdmin.publicKey
        )[0],
        testEnvironment.accessControlHelper.accessControlPubkey,
        testEnvironment.contractAdmin
      );
    } catch (error) {
      console.log("error=", error);
      throw error;
    }
  });

  it("200 create Schedule", async () => {
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4); // 4 days

    for (let i = 0; i < 200; i++) {
      const scheduleId = await createReleaseSchedule(
        tokenlockProgram,
        tokenlockAccount,
        totalBatches,
        new anchor.BN(firstDelay),
        firstBatchBips,
        new anchor.BN(batchDelay),
        testEnvironment.accessControlHelper.accessControlPubkey,
        testEnvironment.accessControlHelper.walletRolePDA(
          reserveAdmin.publicKey
        )[0],
        reserveAdmin
      );

      console.log("create schedule=", i);
      assert(scheduleId === i);
    }
  });

  it("200 fund release Schedule", async () => {
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4); // 4 days
    const commence = -3600 * 24;

    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockAccount,
      totalBatches,
      new anchor.BN(firstDelay),
      firstBatchBips,
      new anchor.BN(batchDelay),
      testEnvironment.accessControlHelper.accessControlPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        reserveAdmin.publicKey
      )[0],
      reserveAdmin
    );
    console.log("scheduleId=", scheduleId);
    assert(scheduleId === 0);

    await topUpWallet(
      testEnvironment.connection,
      reserveAdmin.publicKey,
      2_000_000_000
    );
    let nowTs = await getNowTs(testEnvironment.connection);
    for (let i = 0; i < 100; i++) {
      const timelockId = await fundReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(490),
        new anchor.BN(nowTs + commence),
        scheduleId,
        [walletC.publicKey, reserveAdmin.publicKey, walletB.publicKey],
        tokenlockAccount,
        escrow,
        pda,
        walletB.publicKey,
        reserveAdmin,
        testEnvironment.accessControlHelper.walletRolePDA(
          reserveAdmin.publicKey
        )[0],
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      );
      console.log("created timelock=", i);
      assert(timelockId === i);
    }

    await topUpWallet(
      testEnvironment.connection,
      reserveAdmin.publicKey,
      2_000_000_000
    );
    nowTs = await getNowTs(testEnvironment.connection);
    for (let i = 0; i < 100; i++) {
      const timelockId = await fundReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(490),
        new anchor.BN(nowTs + commence),
        scheduleId,
        [walletC.publicKey, reserveAdmin.publicKey, walletB.publicKey],
        tokenlockAccount,
        escrow,
        pda,
        walletC.publicKey,
        reserveAdmin,
        testEnvironment.accessControlHelper.walletRolePDA(
          reserveAdmin.publicKey
        )[0],
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      );
      console.log("2nd created timelock=", i);
      assert(timelockId === i);
    }
  });

  it("100 funds release Schedule for different recipients", async () => {
    const totalBatches = 3;
    const firstDelay = 0;
    const firstBatchBips = 800; // 8%
    const batchDelay = fromDaysToSeconds(4); // 4 days
    const commence = -3600 * 24;

    const scheduleId = await createReleaseSchedule(
      tokenlockProgram,
      tokenlockAccount,
      totalBatches,
      new anchor.BN(firstDelay),
      firstBatchBips,
      new anchor.BN(batchDelay),
      testEnvironment.accessControlHelper.accessControlPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        reserveAdmin.publicKey
      )[0],
      reserveAdmin
    );
    console.log("scheduleId=", scheduleId);
    assert(scheduleId === 0);

    await topUpWallet(
      testEnvironment.connection,
      reserveAdmin.publicKey,
      2_000_000_000
    );
    let nowTs = await getNowTs(testEnvironment.connection);
    for (let i = 0; i < 100; i++) {
      const timelockId = await fundReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(490),
        new anchor.BN(nowTs + commence),
        scheduleId,
        [walletC.publicKey, reserveAdmin.publicKey, walletB.publicKey],
        tokenlockAccount,
        escrow,
        pda,
        walletB.publicKey,
        reserveAdmin,
        testEnvironment.accessControlHelper.walletRolePDA(
          reserveAdmin.publicKey
        )[0],
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      );
      console.log("created timelock=", i);
      assert(timelockId === i);
    }

    await topUpWallet(
      testEnvironment.connection,
      reserveAdmin.publicKey,
      2_000_000_000
    );
    nowTs = await getNowTs(testEnvironment.connection);
    for (let i = 0; i < 100; i++) {
      const timelockId = await fundReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(490),
        new anchor.BN(nowTs + commence),
        scheduleId,
        [walletC.publicKey, reserveAdmin.publicKey, walletB.publicKey],
        tokenlockAccount,
        escrow,
        pda,
        walletC.publicKey,
        reserveAdmin,
        testEnvironment.accessControlHelper.walletRolePDA(
          reserveAdmin.publicKey
        )[0],
        testEnvironment.accessControlHelper.accessControlPubkey,
        mintPubkey,
        testEnvironment.accessControlHelper.program.programId
      );
      console.log("2nd created timelock=", i);
      assert(timelockId === i);
    }
  });
});
