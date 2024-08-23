import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { createAccount, solToLamports, topUpWallet } from "../utils";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Tokenlock } from "../../target/types/tokenlock";
import {
  createReleaseSchedule,
  initializeTokenlock,
  MAX_RELEASE_DELAY,
  mintReleaseSchedule,
} from "../helpers/tokenlock_helper";
import { fromDaysToSeconds } from "../helpers/datetime";
import { getNowTs } from "../helpers/clock_helper";

describe("Access Control burn securities", () => {
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
  let reserveAdminWalletRole: PublicKey;
  let reserveAdminTokenAccountPubkey: PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();
    await testEnvironment.mintToReserveAdmin();

    [reserveAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.reserveAdmin.publicKey
      );
    reserveAdminTokenAccountPubkey =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(
        testEnvironment.reserveAdmin.publicKey
      );
  });

  it("fails to burn more than maxTotalSupply", async () => {
    const { supply: currentSupply } =
      await testEnvironment.mintHelper.getMint();
    const amount = new anchor.BN(currentSupply.toString()).addn(1);
    try {
      await testEnvironment.accessControlHelper.burnSecurities(
        amount,
        testEnvironment.reserveAdmin.publicKey,
        reserveAdminTokenAccountPubkey,
        testEnvironment.reserveAdmin
      );
      assert.fail("Expected an error");
    } catch (error) {
      const res = error.logs.some(
        (log: string) => log === "Program log: Error: insufficient funds"
      );
      assert.isTrue(res);
    }
  });

  it("does not allow burning by non-reserve admin", async () => {
    const amount = new anchor.BN(1_000_000);
    try {
      await testEnvironment.accessControlHelper.burnSecurities(
        amount,
        testEnvironment.reserveAdmin.publicKey,
        reserveAdminTokenAccountPubkey,
        testEnvironment.walletsAdmin
      );
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails when signer is not the authority", async () => {
    const amount = new anchor.BN(1_000_000);
    const reserveAdminPretender = new Keypair();
    await topUpWallet(
      testEnvironment.connection,
      reserveAdminPretender.publicKey,
      solToLamports(1)
    );

    try {
      await testEnvironment.accessControlHelper.program.methods
        .burnSecurities(amount)
        .accountsStrict({
          authority: testEnvironment.reserveAdmin.publicKey,
          authorityWalletRole: reserveAdminWalletRole,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          targetAccount: reserveAdminTokenAccountPubkey,
          targetAuthority: testEnvironment.reserveAdmin.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([reserveAdminPretender])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch (error) {
      assert.equal(
        error.toString(),
        `Error: unknown signer: ${reserveAdminPretender.publicKey.toBase58()}`
      );
    }
  });

  const attackerTestEnvironmentParams: TestEnvironmentParams = {
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
  let attackerEnvironment: TestEnvironment;
  it("fails when attacker subtitute authority, wallet role and signer", async () => {
    attackerEnvironment = new TestEnvironment(attackerTestEnvironmentParams);
    await attackerEnvironment.setupAccessControl();
    const amount = new anchor.BN(1_000_000);
    const [attackerReserveAdminWalletRole] =
      attackerEnvironment.accessControlHelper.walletRolePDA(
        attackerEnvironment.reserveAdmin.publicKey
      );
    try {
      await testEnvironment.accessControlHelper.program.methods
        .burnSecurities(amount)
        .accountsStrict({
          authority: attackerEnvironment.reserveAdmin.publicKey,
          authorityWalletRole: attackerReserveAdminWalletRole,
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          securityMint: testEnvironment.mintKeypair.publicKey,
          targetAccount: reserveAdminTokenAccountPubkey,
          targetAuthority: testEnvironment.reserveAdmin.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([attackerEnvironment.reserveAdmin])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "ConstraintSeeds");
      assert.equal(error.errorMessage, "A seeds constraint was violated");
    }
  });

  it("burn securities", async () => {
    const amount = new anchor.BN(1_000_000);
    const { supply: supplyBeforeBurn } =
      await testEnvironment.mintHelper.getMint();
    const { amount: reserveAdminAmountBefore } =
      await testEnvironment.mintHelper.getAccount(
        reserveAdminTokenAccountPubkey
      );
    await testEnvironment.accessControlHelper.burnSecurities(
      amount,
      testEnvironment.reserveAdmin.publicKey,
      reserveAdminTokenAccountPubkey,
      testEnvironment.reserveAdmin
    );

    const { supply: supplyAfterBurn } =
      await testEnvironment.mintHelper.getMint();
    const { amount: reserveAdminAmountAfter } =
      await testEnvironment.mintHelper.getAccount(
        reserveAdminTokenAccountPubkey
      );
    assert.equal(
      reserveAdminAmountAfter,
      reserveAdminAmountBefore - BigInt(amount.toString())
    );
    assert.equal(supplyAfterBurn, supplyBeforeBurn - BigInt(amount.toString()));
  });

  describe("when tokenlock escrow is set", () => {
    const tokenlockProgram = anchor.workspace
      .Tokenlock as anchor.Program<Tokenlock>;
    let tokenlockDataPubkey: PublicKey;
    let tokenlockWallet: Keypair;
    let escrowAccount: PublicKey;
    let escrowOwnerPubkey: PublicKey;
    const investorWallet = Keypair.generate();

    before(async () => {
      tokenlockWallet = Keypair.generate();
      tokenlockDataPubkey = tokenlockWallet.publicKey;

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
      [escrowOwnerPubkey] = PublicKey.findProgramAddressSync(
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

      const totalBatches = 4;
      const firstDelay = 0;
      const firstBatchBips = 800; // 8%
      const batchDelay = fromDaysToSeconds(4); // 4 days
      const scheduleId = await createReleaseSchedule(
        tokenlockProgram,
        tokenlockDataPubkey,
        totalBatches,
        new anchor.BN(firstDelay),
        firstBatchBips,
        new anchor.BN(batchDelay),
        testEnvironment.accessControlHelper.accessControlPubkey,
        reserveAdminWalletRole,
        testEnvironment.reserveAdmin
      );

      let nowTs = await getNowTs(testEnvironment.connection);
      await mintReleaseSchedule(
        testEnvironment.connection,
        tokenlockProgram,
        new anchor.BN(1_000_000),
        new anchor.BN(nowTs),
        Number(scheduleId),
        [testEnvironment.reserveAdmin.publicKey],
        tokenlockDataPubkey,
        escrowAccount,
        escrowOwnerPubkey,
        investorWallet.publicKey,
        testEnvironment.reserveAdmin,
        reserveAdminWalletRole,
        testEnvironment.accessControlHelper.accessControlPubkey,
        testEnvironment.mintKeypair.publicKey,
        testEnvironment.accessControlProgram.programId
      );

      await testEnvironment.accessControlProgram.methods
        .setLockupEscrowAccount()
        .accountsStrict({
          mint: testEnvironment.mintKeypair.publicKey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authorityWalletRole:
            testEnvironment.accessControlHelper.walletRolePDA(
              testEnvironment.contractAdmin.publicKey
            )[0],
          escrowAccount,
          tokenlockAccount: tokenlockDataPubkey,
          payer: testEnvironment.contractAdmin.publicKey,
        })
        .signers([testEnvironment.contractAdmin])
        .rpc({ commitment: testEnvironment.commitment });
    });

    it("fails to burn securities within lockup escrow", async () => {
      const amount = new anchor.BN(1_000_000);
      try {
        await testEnvironment.accessControlHelper.burnSecurities(
          amount,
          escrowOwnerPubkey,
          escrowAccount,
          testEnvironment.reserveAdmin
        );
        assert.fail("Expected an error");
      } catch ({ error }) {
        assert.equal(error.errorCode.code, "CantBurnSecuritiesWithinLockup");
        assert.equal(
          error.errorMessage,
          "Cannot burn securities within lockup; cancel the lockup first"
        );
      }
    });
  });
});
