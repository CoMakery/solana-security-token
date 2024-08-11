import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, SystemProgram } from "@solana/web3.js";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "../helpers/test_environment";
import { createMint, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

describe("Initialize transfer restriction data", () => {
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

  before(async () => {
    testEnvironment = new TestEnvironment(testEnvironmentParams);
    await testEnvironment.setupAccessControl();
  });

  it("fails to initialize data with non-zero group", async () => {
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      );
    const groupIdx = new anchor.BN(1);
    const [groupPDA] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionsData(
          new anchor.BN(testEnvironmentParams.maxHolders)
        )
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: testEnvironment.contractAdmin.publicKey,
          zeroTransferRestrictionGroup: groupPDA,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([testEnvironment.contractAdmin])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "ConstraintSeeds");
      assert.equal(error.errorMessage, "A seeds constraint was violated");
    }
  });

  it("fails to initialize data with another mint then in accessControlData", async () => {
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      );
    const groupIdx = new anchor.BN(0);
    const [groupPDA] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupIdx);
    const newMint = Keypair.generate();
    await createMint(
      testEnvironment.connection,
      testEnvironment.contractAdmin,
      testEnvironment.contractAdmin.publicKey,
      null,
      testEnvironmentParams.mint.decimals,
      newMint,
      { commitment: testEnvironment.commitment },
      TOKEN_2022_PROGRAM_ID
    );
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionsData(
          new anchor.BN(testEnvironmentParams.maxHolders)
        )
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: newMint.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: testEnvironment.contractAdmin.publicKey,
          zeroTransferRestrictionGroup: groupPDA,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([testEnvironment.contractAdmin])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "ConstraintSeeds");
      assert.equal(error.errorMessage, "A seeds constraint was violated");
    }
  });

  it("fails to initialize data with reserve admin", async () => {
    const signer = testEnvironment.reserveAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const groupIdx = new anchor.BN(0);
    const [groupPDA] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionsData(
          new anchor.BN(testEnvironmentParams.maxHolders)
        )
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          zeroTransferRestrictionGroup: groupPDA,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to initialize data with wallets admin", async () => {
    const signer = testEnvironment.walletsAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const groupIdx = new anchor.BN(0);
    const [groupPDA] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionsData(
          new anchor.BN(testEnvironmentParams.maxHolders)
        )
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          zeroTransferRestrictionGroup: groupPDA,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("fails to initialize data with transfer admin", async () => {
    const signer = testEnvironment.transferAdmin;
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(signer.publicKey);
    const groupIdx = new anchor.BN(0);
    const [groupPDA] =
      testEnvironment.transferRestrictionsHelper.groupPDA(groupIdx);
    try {
      await testEnvironment.transferRestrictionsHelper.program.methods
        .initializeTransferRestrictionsData(
          new anchor.BN(testEnvironmentParams.maxHolders)
        )
        .accountsStrict({
          transferRestrictionData:
            testEnvironment.transferRestrictionsHelper
              .transferRestrictionDataPubkey,
          accessControlAccount:
            testEnvironment.accessControlHelper.accessControlPubkey,
          mint: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          payer: signer.publicKey,
          zeroTransferRestrictionGroup: groupPDA,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([signer])
        .rpc({ commitment: testEnvironment.commitment });
      assert.fail("Expected an error");
    } catch ({ error }) {
      assert.equal(error.errorCode.code, "Unauthorized");
      assert.equal(error.errorMessage, "Unauthorized");
    }
  });

  it("initializes transfer restrictions", async () => {
    const [authorityWalletRolePubkey] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.contractAdmin.publicKey
      );
    const [groupPDA] = testEnvironment.transferRestrictionsHelper.groupPDA(
      new anchor.BN(0)
    );
    await testEnvironment.transferRestrictionsHelper.program.methods
      .initializeTransferRestrictionsData(
        new anchor.BN(testEnvironmentParams.maxHolders)
      )
      .accountsStrict({
        transferRestrictionData:
          testEnvironment.transferRestrictionsHelper
            .transferRestrictionDataPubkey,
        accessControlAccount:
          testEnvironment.accessControlHelper.accessControlPubkey,
        mint: testEnvironment.mintKeypair.publicKey,
        authorityWalletRole: authorityWalletRolePubkey,
        payer: testEnvironment.contractAdmin.publicKey,
        zeroTransferRestrictionGroup: groupPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([testEnvironment.contractAdmin])
      .rpc({ commitment: testEnvironment.commitment });
    const trData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.equal(
      trData.securityTokenMint.toString(),
      testEnvironment.mintKeypair.publicKey.toString()
    );
    assert.equal(
      trData.accessControlAccount.toString(),
      testEnvironment.accessControlHelper.accessControlPubkey.toString()
    );
    assert.equal(trData.currentHoldersCount.toNumber(), 0);
    assert.equal(trData.holderIds.toNumber(), 0);
    assert.equal(
      trData.maxHolders.toNumber(),
      testEnvironmentParams.maxHolders
    );
    assert.equal(trData.paused, false);
    assert.equal(trData.lockupEscrowAccount, undefined);

    const groupData =
      await testEnvironment.transferRestrictionsHelper.groupData(groupPDA);
    assert.equal(groupData.currentHoldersCount.toNumber(), 0);
    assert.equal(groupData.id.toNumber(), 0);
    assert.equal(
      groupData.maxHolders.toNumber(),
      testEnvironmentParams.maxHolders
    );
    assert.equal(
      groupData.transferRestrictionData.toString(),
      testEnvironment.transferRestrictionsHelper.transferRestrictionDataPubkey.toString()
    );
  });
});
