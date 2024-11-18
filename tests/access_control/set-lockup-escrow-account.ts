import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import {
  getOrCreateTimelockAccount,
  initializeTokenlock,
  MAX_RELEASE_DELAY,
} from "../helpers/tokenlock_helper";
import { Tokenlock } from "../../target/types/tokenlock";
import { createAccount, solToLamports, topUpWallet } from "../utils";

describe("Set lockup escrow account", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://example.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 3,
    maxTotalSupply: 100_000_000_000_000,
  };
  let testEnvironment: TestEnvironment;
  const tokenlockProgram = anchor.workspace
    .Tokenlock as anchor.Program<Tokenlock>;
  let tokenlockDataPubkey: anchor.web3.PublicKey;
  let tokenlockWallet: anchor.web3.Keypair;
  let escrowAccount: anchor.web3.PublicKey;
  let escrowOwnerPubkey: anchor.web3.PublicKey;

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
    await testEnvironment.setupTransferRestrictions();

    tokenlockWallet = anchor.web3.Keypair.generate();
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
      testEnvironment.mintKeypair.publicKey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      )[0],
      testEnvironment.accessControlHelper.accessControlPubkey,
      testEnvironment.contractAdmin
    );
  });

  it("fails to set lockup escrow account by reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    try {
      await testEnvironment.accessControlHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        signer
      );
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to set lockup escrow account by transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    try {
      await testEnvironment.accessControlHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        signer
      );
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to set lockup escrow account by wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    try {
      await testEnvironment.accessControlHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        signer
      );
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to set lockup escrow account differ from tokenlock data", async () => {
    const signer = testEnvironment.contractAdmin;
    const [escrowOwnerReplacedPubkey] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("tokenlock1"),
          testEnvironment.mintKeypair.publicKey.toBuffer(),
          tokenlockDataPubkey.toBuffer(),
        ],
        tokenlockProgram.programId
      );
    const escrowReplacedAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        escrowOwnerReplacedPubkey,
        testEnvironment.contractAdmin,
        true
      );

    try {
      await testEnvironment.accessControlHelper.setLockupEscrowAccount(
        escrowReplacedAccount,
        tokenlockDataPubkey,
        signer
      );
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "MismatchedEscrowAccount");
      assert.equal(error.errorMessage, "Mismatched escrow account");
    }
  });

  it("fails to set lockup escrow account when tokenlock data account discrimanor is incorrect", async () => {
    const signer = testEnvironment.contractAdmin;
    const recipient = anchor.web3.Keypair.generate();
    const timelockAccount = await getOrCreateTimelockAccount(
      tokenlockProgram,
      tokenlockDataPubkey,
      recipient.publicKey,
      testEnvironment.accessControlHelper.accessControlPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.reserveAdmin.publicKey
      )[0],
      testEnvironment.reserveAdmin
    );

    try {
      await testEnvironment.accessControlHelper.setLockupEscrowAccount(
        escrowAccount,
        timelockAccount,
        signer
      );
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "IncorrectTokenlockAccount");
      assert.equal(error.errorMessage, "Wrong tokenlock account");
    }
  });

  it("sets lockup escrow account by contract admin", async () => {
    const signer = testEnvironment.contractAdmin;
    const { lockupEscrowAccount } =
      await testEnvironment.accessControlHelper.accessControlData();
    assert.equal(lockupEscrowAccount, null);

    await testEnvironment.accessControlHelper.setLockupEscrowAccount(
      escrowAccount,
      tokenlockDataPubkey,
      signer
    );
    const { lockupEscrowAccount: lockupEscrowAccountAfter } =
      await testEnvironment.accessControlHelper.accessControlData();
    assert.equal(lockupEscrowAccountAfter.toString(), escrowAccount.toString());
  });

  it("fails to set lockup escrow account when it is already set", async () => {
    const signer = testEnvironment.contractAdmin;
    try {
      await testEnvironment.accessControlHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        signer
      );
      assert.fail("Expect an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "ValueUnchanged");
      assert.equal(
        error.errorMessage,
        "The provided value is already set. No changes were made"
      );
    }
  });
});
