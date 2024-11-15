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
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    try {
      await testEnvironment.transferRestrictionsHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        authorityWalletRolePubkey,
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
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    try {
      await testEnvironment.transferRestrictionsHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        authorityWalletRolePubkey,
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
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    try {
      await testEnvironment.transferRestrictionsHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        authorityWalletRolePubkey,
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
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
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
      await testEnvironment.transferRestrictionsHelper.setLockupEscrowAccount(
        escrowReplacedAccount,
        tokenlockDataPubkey,
        authorityWalletRolePubkey,
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
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

    try {
      await testEnvironment.transferRestrictionsHelper.setLockupEscrowAccount(
        escrowAccount,
        timelockAccount,
        authorityWalletRolePubkey,
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
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const { lockupEscrowAccount } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(lockupEscrowAccount, null);

    await testEnvironment.transferRestrictionsHelper.setLockupEscrowAccount(
      escrowAccount,
      tokenlockDataPubkey,
      authorityWalletRolePubkey,
      signer
    );
    const { lockupEscrowAccount: lockupEscrowAccountAfter } =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(lockupEscrowAccountAfter.toString(), escrowAccount.toString());
  });

  it("fails to set same lockup escrow account as it is on-chain", async () => {
    const signer = testEnvironment.contractAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);

    try {
      await testEnvironment.transferRestrictionsHelper.setLockupEscrowAccount(
        escrowAccount,
        tokenlockDataPubkey,
        authorityWalletRolePubkey,
        signer
      );
      assert.fail("Expect an error");
    } catch (error) {
      const [escrowSecurityAssociatedAccountPubkey] =
        testEnvironment.transferRestrictionsHelper.securityAssociatedAccountPDA(
          escrowAccount
        );
      const errorMessage = `Allocate: account Address { address: ${escrowSecurityAssociatedAccountPubkey.toString()}, base: None } already in use`;
      const containsError = error.logs.some((log: string | string[]) =>
        log.includes(errorMessage)
      );
      assert.isTrue(containsError);
    }
  });
});
