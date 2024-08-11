import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { solToLamports, topUpWallet } from "../utils";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

describe("Access Control burn securities", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://e.com",
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
      uri: "https://e.com",
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
});
