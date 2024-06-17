import * as anchor from "@coral-xyz/anchor";
import {
  Program,
} from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  getMetadataPointerState,
  getTokenMetadata,
  getTransferHook,
  addExtraAccountMetasForExecute,
} from "@solana/spl-token";
import { assert } from "chai";
import {
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction
} from "@solana/web3.js";

import {
  Roles,
} from "./helpers/access-control_helper";
import { Tokenlock } from "../target/types/tokenlock";

import { TestEnvironment, TestEnvironmentParams } from "./helpers/test_environment";
import { createAccount, solToLamports, topUpWallet } from "./utils";
import { calcSignerHash, getTimelockAccount, lockedBalanceOf, unlockedBalanceOf, uuidBytes } from "./helpers/tokenlock_helper";
import { getNowTs } from "./helpers/clock_helper";

describe("solana-security-token", () => {
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
  const testEnvironment = new TestEnvironment(testEnvironmentParams);
  const tokenlockProgram = anchor.workspace
    .Tokenlock as Program<Tokenlock>;

  before("setups environment", async () => {
    await testEnvironment.setup();
  });

  it("setups test environment", async () => {
    const accessControlData = await testEnvironment.accessControlHelper.accessControlData();
    assert.deepEqual(accessControlData.mint, testEnvironment.mintKeypair.publicKey);

    const walletRoleData = await testEnvironment.accessControlHelper.walletRoleData(
      testEnvironment.accessControlHelper.walletRolePDA(testEnvironment.contractAdmin.publicKey)[0]
    );

    assert.deepEqual(walletRoleData.role, Roles.ContractAdmin);
    assert.deepEqual(accessControlData.authority, testEnvironment.contractAdmin.publicKey);

    const mintData = await testEnvironment.mintHelper.getMint();
    assert.deepEqual(mintData.mintAuthority, testEnvironment.accessControlHelper.accessControlPubkey);
    assert.deepEqual(mintData.supply, BigInt(testEnvironmentParams.initialSupply));
    assert.deepEqual(mintData.decimals, testEnvironmentParams.mint.decimals);
    assert.deepEqual(mintData.isInitialized, true);
    assert.deepEqual(mintData.freezeAuthority, testEnvironment.accessControlHelper.accessControlPubkey);

    // Retrieve and verify the metadata pointer state
    const metadataPointer = getMetadataPointerState(mintData);
    assert.deepEqual(metadataPointer.authority, testEnvironment.accessControlHelper.accessControlPubkey)
    assert.deepEqual(metadataPointer.metadataAddress, testEnvironment.mintKeypair.publicKey)

    // Retrieve and verify the metadata state
    const metadata = await getTokenMetadata(
      testEnvironment.connection,
      testEnvironment.mintKeypair.publicKey, // Mint Account address
    );
    assert.deepEqual(metadata.mint, testEnvironment.mintKeypair.publicKey);
    assert.deepEqual(metadata.updateAuthority, testEnvironment.accessControlHelper.accessControlPubkey);
    assert.equal(metadata.name, testEnvironmentParams.mint.name);
    assert.equal(metadata.symbol, testEnvironmentParams.mint.symbol);
    assert.equal(metadata.uri, testEnvironmentParams.mint.uri);


    const transferRestrictionData = await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.deepEqual(transferRestrictionData.securityTokenMint, testEnvironment.mintKeypair.publicKey);
    assert.deepEqual(transferRestrictionData.accessControlAccount, testEnvironment.accessControlHelper.accessControlPubkey);
    assert.equal(transferRestrictionData.currentHoldersCount.toNumber(), 0);
    assert.equal(transferRestrictionData.maxHolders.toNumber(), testEnvironmentParams.maxHolders);

  });

  let tokenlockDataPubkey: anchor.web3.PublicKey;
  let escrowOwnerPubkey: anchor.web3.PublicKey;
  let escrowAccount: anchor.web3.PublicKey;

  it("intializes token lockup", async () => {
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
    )
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from('tokenlock'),
        testEnvironment.mintKeypair.publicKey.toBuffer(),
        tokenlockDataPubkey.toBuffer(),
      ],
      tokenlockProgram.programId,
    );
    escrowOwnerPubkey = pda
    escrowAccount = await testEnvironment.mintHelper.createAssociatedTokenAccount(
      pda,
      testEnvironment.contractAdmin,
      true
    );

    const maxReleaseDelay = new anchor.BN(346896000);
    const minTimelockAmount = new anchor.BN(100);
    const initializeTokenlockSignature = await tokenlockProgram.rpc.initializeTokenlock(
      maxReleaseDelay,
      minTimelockAmount,
      {
        accounts: {
          tokenlockAccount: tokenlockDataPubkey,
          escrowAccount,
          mintAddress: testEnvironment.mintKeypair.publicKey,
          authorityWalletRole: testEnvironment.accessControlHelper.walletRolePDA(testEnvironment.contractAdmin.publicKey)[0],
          accessControl: testEnvironment.accessControlHelper.accessControlPubkey,
          authority: testEnvironment.contractAdmin.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        },
        signers: [testEnvironment.contractAdmin],
      },
    );
    console.log("Initialize Tokenlock Transaction Signature", initializeTokenlockSignature);

    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(tokenlockDataPubkey);
    assert.deepEqual(tokenlockData.escrowAccount, escrowAccount);
    assert.deepEqual(tokenlockData.mintAddress, testEnvironment.mintKeypair.publicKey);
    assert.deepEqual(tokenlockData.accessControl, testEnvironment.accessControlHelper.accessControlPubkey);
    assert.equal(tokenlockData.releaseSchedules.length, 0);
    assert.equal(tokenlockData.maxReleaseDelay.toString(), maxReleaseDelay.toString());
    assert.equal(tokenlockData.minTimelockAmount.toString(), minTimelockAmount.toString());
  });
});
