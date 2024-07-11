import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
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
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";

import { Roles } from "./helpers/access-control_helper";
import { Tokenlock } from "../target/types/tokenlock";

import {
  TestEnvironment,
  TestEnvironmentParams,
} from "./helpers/test_environment";
import { createAccount, solToLamports, topUpWallet } from "./utils";
import {
  BIPS_PRECISION,
  calcSignerHash,
  getTimelockAccount,
  lockedBalanceOf,
  unlockedBalanceOf,
  uuidBytes,
} from "./helpers/tokenlock_helper";
import { getNowTs } from "./helpers/clock_helper";

describe("token lockup", () => {
  const testEnvironmentParams: TestEnvironmentParams = {
    mint: {
      decimals: 6,
      name: "XYZ Token",
      symbol: "XYZ",
      uri: "https://e.com",
    },
    initialSupply: 1_000_000_000_000,
    maxHolders: 10000,
    minWalletBalance: 0
  };
  const testEnvironment = new TestEnvironment(testEnvironmentParams);
  const tokenlockProgram = anchor.workspace.Tokenlock as Program<Tokenlock>;

  before("setups environment", async () => {
    await testEnvironment.setup();
  });

  it("setups test environment", async () => {
    const accessControlData =
      await testEnvironment.accessControlHelper.accessControlData();
    assert.deepEqual(
      accessControlData.mint,
      testEnvironment.mintKeypair.publicKey
    );

    const walletRoleData =
      await testEnvironment.accessControlHelper.walletRoleData(
        testEnvironment.accessControlHelper.walletRolePDA(
          testEnvironment.contractAdmin.publicKey
        )[0]
      );

    assert.deepEqual(walletRoleData.role, Roles.ContractAdmin);
    assert.deepEqual(
      accessControlData.authority,
      testEnvironment.contractAdmin.publicKey
    );

    const mintData = await testEnvironment.mintHelper.getMint();
    assert.deepEqual(
      mintData.mintAuthority,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.deepEqual(
      mintData.supply,
      BigInt(testEnvironmentParams.initialSupply)
    );
    assert.deepEqual(mintData.decimals, testEnvironmentParams.mint.decimals);
    assert.deepEqual(mintData.isInitialized, true);
    assert.deepEqual(
      mintData.freezeAuthority,
      testEnvironment.accessControlHelper.accessControlPubkey
    );

    // Retrieve and verify the metadata pointer state
    const metadataPointer = getMetadataPointerState(mintData);
    assert.deepEqual(
      metadataPointer.authority,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.deepEqual(
      metadataPointer.metadataAddress,
      testEnvironment.mintKeypair.publicKey
    );

    // Retrieve and verify the metadata state
    const metadata = await getTokenMetadata(
      testEnvironment.connection,
      testEnvironment.mintKeypair.publicKey // Mint Account address
    );
    assert.deepEqual(metadata.mint, testEnvironment.mintKeypair.publicKey);
    assert.deepEqual(
      metadata.updateAuthority,
      testEnvironment.contractAdmin.publicKey
    );
    assert.equal(metadata.name, testEnvironmentParams.mint.name);
    assert.equal(metadata.symbol, testEnvironmentParams.mint.symbol);
    assert.equal(metadata.uri, testEnvironmentParams.mint.uri);

    const transferRestrictionData =
      await testEnvironment.transferRestrictionsHelper.transferRestrictionData();
    assert.deepEqual(
      transferRestrictionData.securityTokenMint,
      testEnvironment.mintKeypair.publicKey
    );
    assert.deepEqual(
      transferRestrictionData.accessControlAccount,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.equal(transferRestrictionData.currentHoldersCount.toNumber(), 0);
    assert.equal(
      transferRestrictionData.maxHolders.toNumber(),
      testEnvironmentParams.maxHolders
    );
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
    );
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("tokenlock"),
        testEnvironment.mintKeypair.publicKey.toBuffer(),
        tokenlockDataPubkey.toBuffer(),
      ],
      tokenlockProgram.programId
    );
    escrowOwnerPubkey = pda;
    escrowAccount =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        pda,
        testEnvironment.contractAdmin,
        true
      );

    const maxReleaseDelay = new anchor.BN(346896000);
    const minTimelockAmount = new anchor.BN(100);
    const initializeTokenlockSignature =
      await tokenlockProgram.rpc.initializeTokenlock(
        maxReleaseDelay,
        minTimelockAmount,
        {
          accounts: {
            tokenlockAccount: tokenlockDataPubkey,
            escrowAccount,
            mintAddress: testEnvironment.mintKeypair.publicKey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                testEnvironment.contractAdmin.publicKey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            authority: testEnvironment.contractAdmin.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          },
          signers: [testEnvironment.contractAdmin],
        }
      );
    console.log(
      "Initialize Tokenlock Transaction Signature",
      initializeTokenlockSignature
    );

    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    assert.deepEqual(tokenlockData.escrowAccount, escrowAccount);
    assert.deepEqual(
      tokenlockData.mintAddress,
      testEnvironment.mintKeypair.publicKey
    );
    assert.deepEqual(
      tokenlockData.accessControl,
      testEnvironment.accessControlHelper.accessControlPubkey
    );
    assert.equal(tokenlockData.releaseSchedules.length, 0);
    assert.equal(
      tokenlockData.maxReleaseDelay.toString(),
      maxReleaseDelay.toString()
    );
    assert.equal(
      tokenlockData.minTimelockAmount.toString(),
      minTimelockAmount.toString()
    );
  });

  const uuid = uuidBytes();
  let signerHash: number[];
  const releaseCount = 10;
  const delayUntilFirstReleaseInSeconds = 0;
  const initialReleasePortionInBips = 1000;
  const periodBetweenReleasesInSeconds = 86400;
  it("adds release schedule", async () => {
    const authourityPubkey = testEnvironment.contractAdmin.publicKey;
    signerHash = calcSignerHash(authourityPubkey, uuid);

    const createReleaseScheduleTxSignature =
      await tokenlockProgram.rpc.createReleaseSchedule(
        uuid,
        releaseCount,
        new anchor.BN(delayUntilFirstReleaseInSeconds),
        initialReleasePortionInBips,
        new anchor.BN(periodBetweenReleasesInSeconds),
        {
          accounts: {
            tokenlockAccount: tokenlockDataPubkey,
            authority: authourityPubkey,
            authorityWalletRole:
              testEnvironment.accessControlHelper.walletRolePDA(
                authourityPubkey
              )[0],
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
          },
          signers: [testEnvironment.contractAdmin],
        }
      );
    const tokenLockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    assert.equal(tokenLockData.releaseSchedules.length, 1);
    assert.deepEqual(tokenLockData.releaseSchedules[0].signerHash, signerHash);
    assert.equal(tokenLockData.releaseSchedules[0].releaseCount, releaseCount);
    assert.equal(
      tokenLockData.releaseSchedules[0].delayUntilFirstReleaseInSeconds.toNumber(),
      delayUntilFirstReleaseInSeconds
    );
    assert.equal(
      tokenLockData.releaseSchedules[0].initialReleasePortionInBips,
      initialReleasePortionInBips
    );
    assert.equal(
      tokenLockData.releaseSchedules[0].periodBetweenReleasesInSeconds.toNumber(),
      periodBetweenReleasesInSeconds
    );
    console.log(
      "Create Release Schedule Transaction Signature",
      createReleaseScheduleTxSignature
    );
  });

  const investor = anchor.web3.Keypair.generate();
  const fundedAmount = 1_000_000;
  it("funds release schedule", async () => {
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      investor.publicKey
    );
    let accInfo = await testEnvironment.connection.getAccountInfo(
      timelockAccount
    );
    if (accInfo === null) {
      const tx = await tokenlockProgram.rpc.initializeTimelock({
        accounts: {
          tokenlockAccount: tokenlockDataPubkey,
          timelockAccount: timelockAccount,
          authorityWalletRole:
            testEnvironment.accessControlHelper.walletRolePDA(
              testEnvironment.reserveAdmin.publicKey
            )[0],
          accessControl:
            testEnvironment.accessControlHelper.accessControlPubkey,
          authority: testEnvironment.reserveAdmin.publicKey,
          targetAccount: investor.publicKey,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        },
        signers: [testEnvironment.reserveAdmin],
      });
      console.log("Initialize Timelock Transaction Signature", tx);
    }

    const cancelableBy = [testEnvironment.reserveAdmin.publicKey];

    const scheduleId = 0;
    const commencementTimestamp = await getNowTs(testEnvironment.connection);
    const funderAssociatedTokenAccount =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(
        testEnvironment.reserveAdmin.publicKey
      );
    const authorityWalletRole =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.reserveAdmin.publicKey
      )[0];

    const fundReleaseScheduleInstruction =
      tokenlockProgram.instruction.fundReleaseSchedule(
        uuid,
        new anchor.BN(fundedAmount),
        new anchor.BN(commencementTimestamp),
        scheduleId,
        cancelableBy,
        {
          accounts: {
            tokenlockAccount: tokenlockDataPubkey,
            timelockAccount: timelockAccount,
            escrowAccount: escrowAccount,
            authorityWalletRole: authorityWalletRole,
            accessControl:
              testEnvironment.accessControlHelper.accessControlPubkey,
            mintAddress: testEnvironment.mintKeypair.publicKey,
            from: funderAssociatedTokenAccount,
            to: investor.publicKey,
            authority: testEnvironment.reserveAdmin.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          },
          signers: [testEnvironment.reserveAdmin],
        }
      );

    const [transferAdminWalletRole] = testEnvironment.accessControlHelper.walletRolePDA(
      testEnvironment.transferAdmin.publicKey
    );
    // Initialize holders
    const reserveAdminHolderId = new anchor.BN(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      reserveAdminHolderId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    const recipientHolderId = new anchor.BN(2);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      recipientHolderId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    // Initialize transfer groups
    const reserveAdminGroupId = new anchor.BN(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      reserveAdminGroupId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    const recipientGroupId = new anchor.BN(2);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      recipientGroupId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    const reserveAdminHolderPubkey = testEnvironment.transferRestrictionsHelper.holderPDA(
      reserveAdminHolderId
    )[0];
    const reserveAdminGroupPubkey = testEnvironment.transferRestrictionsHelper.groupPDA(
      reserveAdminGroupId
    )[0];
    const reserveAdminHolderGroupPubkey = testEnvironment.transferRestrictionsHelper.holderGroupPDA(
      reserveAdminHolderPubkey,
      reserveAdminGroupId
    )[0];
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      reserveAdminHolderGroupPubkey,
      reserveAdminHolderPubkey,
      reserveAdminGroupPubkey,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    const recipientHolderPubkey = testEnvironment.transferRestrictionsHelper.holderPDA(
      recipientHolderId
    )[0];
    const recipientGroupIdPubkey = testEnvironment.transferRestrictionsHelper.groupPDA(
      recipientGroupId
    )[0];
    const recipientHolderGroupPubkey = testEnvironment.transferRestrictionsHelper.holderGroupPDA(
      recipientHolderPubkey,
      recipientGroupId
    )[0];
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      recipientHolderGroupPubkey,
      recipientHolderPubkey,
      recipientGroupIdPubkey,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    // Initialize Security Associated Accounts
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      testEnvironment.transferRestrictionsHelper.groupPDA(
        reserveAdminGroupId
      )[0],
      testEnvironment.transferRestrictionsHelper.holderPDA(
        reserveAdminHolderId
      )[0],
      reserveAdminHolderGroupPubkey,
      testEnvironment.reserveAdmin.publicKey,
      testEnvironment.mintHelper.getAssocciatedTokenAddress(
        testEnvironment.reserveAdmin.publicKey
      ),
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      testEnvironment.transferRestrictionsHelper.groupPDA(recipientGroupId)[0],
      testEnvironment.transferRestrictionsHelper.holderPDA(
        recipientHolderId
      )[0],
      recipientHolderGroupPubkey,
      escrowOwnerPubkey,
      escrowAccount,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    // Initialize Transfer Restrictions Rule
    const tsNow = await getNowTs(testEnvironment.connection);
    const lockedUntil = new anchor.BN(tsNow);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      lockedUntil,
      reserveAdminGroupId,
      recipientGroupId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    const mintInfo = await testEnvironment.mintHelper.getMint();
    const transferHook = getTransferHook(mintInfo);
    assert.ok(transferHook);

    await addExtraAccountMetasForExecute(
      testEnvironment.connection,
      fundReleaseScheduleInstruction,
      transferHook.programId,
      funderAssociatedTokenAccount,
      testEnvironment.mintKeypair.publicKey,
      escrowAccount,
      testEnvironment.reserveAdmin.publicKey,
      fundedAmount,
      testEnvironment.confirmOptions
    );

    const fundReleaseScheduleWithHookTx = await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(fundReleaseScheduleInstruction),
      [testEnvironment.reserveAdmin], // userWallet
      { commitment: testEnvironment.confirmOptions }
    );
    console.log(
      "FundReleaseSchedule With Hook Transaction Signature",
      fundReleaseScheduleWithHookTx
    );

    const timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );
    assert.deepEqual(timelockData.tokenlockAccount, tokenlockDataPubkey);
    assert.deepEqual(timelockData.targetAccount, investor.publicKey);
    assert.deepEqual(timelockData.cancelables, cancelableBy);
    assert.equal(timelockData.timelocks.length, 1);
    assert.equal(
      timelockData.timelocks[0].totalAmount.toNumber(),
      fundedAmount
    );
    assert.equal(
      timelockData.timelocks[0].commencementTimestamp.toNumber(),
      commencementTimestamp
    );
    assert.equal(timelockData.timelocks[0].tokensTransferred.toNumber(), 0);
    assert.equal(timelockData.timelocks[0].scheduleId, 0);
    assert.equal(timelockData.timelocks[0].cancelableByCount, 1);

    assert.deepEqual(
      timelockData.timelocks[0].signerHash,
      calcSignerHash(testEnvironment.reserveAdmin.publicKey, uuid)
    );
    const escrowAccountData = await testEnvironment.mintHelper.getAccount(
      escrowAccount
    );
    assert.equal(escrowAccountData.amount.toString(), fundedAmount.toString());
    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    const unlockedBalance = unlockedBalanceOf(
      tokenlockData,
      timelockData,
      tsNow
    );
    const lockedBalance = lockedBalanceOf(tokenlockData, timelockData, tsNow);
    assert.equal(
      unlockedBalance,
      (fundedAmount * initialReleasePortionInBips) / BIPS_PRECISION
    );
    assert.equal(
      lockedBalance,
      fundedAmount -
      (fundedAmount * initialReleasePortionInBips) / BIPS_PRECISION
    );
  });

  let transferAmount;
  it("transfers for recipient", async () => {
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      investor.publicKey
    );
    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    const timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );
    const tsNow = await getNowTs(testEnvironment.connection);
    const unlockedBalance = unlockedBalanceOf(
      tokenlockData,
      timelockData,
      tsNow
    );
    transferAmount = unlockedBalance * 0.35;

    await topUpWallet(
      testEnvironment.connection,
      investor.publicKey,
      solToLamports(1)
    );
    const investorTokenAccountPubkey =
      await testEnvironment.mintHelper.createAssociatedTokenAccount(
        investor.publicKey,
        investor
      );
    // to can be any token account from the group which allows to receive tokens from escrowAccount group
    const transferInstruction = tokenlockProgram.instruction.transfer(
      new anchor.BN(transferAmount),
      {
        accounts: {
          tokenlockAccount: tokenlockDataPubkey,
          timelockAccount,
          escrowAccount: escrowAccount,
          pdaAccount: escrowOwnerPubkey,
          authority: investor.publicKey,
          to: investorTokenAccountPubkey,
          mintAddress: testEnvironment.mintKeypair.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        },
        signers: [investor],
      }
    );
    const mintInfo = await testEnvironment.mintHelper.getMint();
    const transferHook = getTransferHook(mintInfo);
    assert.ok(transferHook);

    const [transferAdminWalletRole] =
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      );
    // create transfer rule escrow -> investorTokenAccountPubkey
    const investorHolderId = new anchor.BN(3);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionHolder(
      investorHolderId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    const investorGroupId = new anchor.BN(3);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRestrictionGroup(
      investorGroupId,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );
    const investorHolderPubkey =
      testEnvironment.transferRestrictionsHelper.holderPDA(investorHolderId)[0];
    const investorGroupPubkey =
      testEnvironment.transferRestrictionsHelper.groupPDA(investorGroupId)[0];
    const investorHolderGroupPubkey =
      testEnvironment.transferRestrictionsHelper.holderGroupPDA(
        investorHolderPubkey,
        investorGroupId
      )[0];
    await testEnvironment.transferRestrictionsHelper.initializeHolderGroup(
      investorHolderGroupPubkey,
      investorHolderPubkey,
      investorGroupPubkey,
      transferAdminWalletRole,
      testEnvironment.transferAdmin
    );

    await testEnvironment.transferRestrictionsHelper.initializeSecurityAssociatedAccount(
      testEnvironment.transferRestrictionsHelper.groupPDA(investorGroupId)[0],
      testEnvironment.transferRestrictionsHelper.holderPDA(investorHolderId)[0],
      investorHolderGroupPubkey,
      investor.publicKey,
      investorTokenAccountPubkey,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.walletsAdmin.publicKey
      )[0],
      testEnvironment.walletsAdmin
    );
    // Initialize Transfer Restrictions Rule
    const lockedUntil = new anchor.BN(tsNow);
    const escrowGroupId = new anchor.BN(2);
    const initializeTransferRuleTxSignature =
      await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
        lockedUntil,
        escrowGroupId,
        investorGroupId,
        transferAdminWalletRole,
        testEnvironment.transferAdmin
      );
    console.log(
      "Initialze transfer rule tx:",
      initializeTransferRuleTxSignature
    );

    await addExtraAccountMetasForExecute(
      testEnvironment.connection,
      transferInstruction,
      transferHook.programId,
      escrowAccount,
      testEnvironment.mintKeypair.publicKey,
      investorTokenAccountPubkey,
      escrowOwnerPubkey,
      transferAmount,
      testEnvironment.confirmOptions
    );

    const transferTxSignature = await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(transferInstruction),
      [investor], // userWallet
      { commitment: testEnvironment.confirmOptions }
    );
    console.log("Transfer Transaction Signature", transferTxSignature);

    const timelockDataAfterTransfer =
      await tokenlockProgram.account.timelockData.fetch(timelockAccount);
    assert.equal(
      timelockDataAfterTransfer.timelocks[0].tokensTransferred.toNumber(),
      transferAmount
    );
    const investorTokenAccountData =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    assert.equal(
      investorTokenAccountData.amount.toString(),
      transferAmount.toString()
    );
  });

  it("transfers from timelock", async () => {
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      investor.publicKey
    );
    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    const timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );
    const tsNow = await getNowTs(testEnvironment.connection);
    const unlockedBalance = unlockedBalanceOf(
      tokenlockData,
      timelockData,
      tsNow
    );
    const transferTimelockAmount = unlockedBalance * 0.35;

    await topUpWallet(
      testEnvironment.connection,
      investor.publicKey,
      solToLamports(1)
    );
    const investorTokenAccountPubkey =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(investor.publicKey);
    console.log(`tokenlockPubkey:`, tokenlockDataPubkey.toString());
    const timelockId = 0;
    // to can be any token account from the group which allows to receive tokens from escrowAccount group
    const transferTimelockInstruction =
      tokenlockProgram.instruction.transferTimelock(
        new anchor.BN(transferTimelockAmount),
        timelockId,
        {
          accounts: {
            tokenlockAccount: tokenlockDataPubkey,
            timelockAccount,
            escrowAccount: escrowAccount,
            pdaAccount: escrowOwnerPubkey,
            authority: investor.publicKey,
            to: investorTokenAccountPubkey,
            mintAddress: testEnvironment.mintKeypair.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          },
          signers: [investor],
        }
      );
    const mintInfo = await testEnvironment.mintHelper.getMint();
    const transferHook = getTransferHook(mintInfo);
    assert.ok(transferHook);

    await addExtraAccountMetasForExecute(
      testEnvironment.connection,
      transferTimelockInstruction,
      transferHook.programId,
      escrowAccount,
      testEnvironment.mintKeypair.publicKey,
      investorTokenAccountPubkey,
      escrowOwnerPubkey,
      transferTimelockAmount,
      testEnvironment.confirmOptions
    );

    const transferTxSignature = await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(transferTimelockInstruction),
      [investor],
      { commitment: testEnvironment.confirmOptions }
    );
    console.log("Transfer Timelock Transaction Signature", transferTxSignature);

    const timelockDataAfterTransfer =
      await tokenlockProgram.account.timelockData.fetch(timelockAccount);
    assert.equal(
      timelockDataAfterTransfer.timelocks[0].tokensTransferred.toNumber(),
      transferAmount + transferTimelockAmount
    );
    const investorTokenAccountData =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    assert.equal(
      investorTokenAccountData.amount.toString(),
      (transferAmount + transferTimelockAmount).toString()
    );
  });

  it("cancel timelock from timelock", async () => {
    const timelockAccount = getTimelockAccount(
      tokenlockProgram.programId,
      tokenlockDataPubkey,
      investor.publicKey
    );
    const tokenlockData = await tokenlockProgram.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    const timelockData = await tokenlockProgram.account.timelockData.fetch(
      timelockAccount
    );
    const tsNow = await getNowTs(testEnvironment.connection);
    const unlockedBalance = unlockedBalanceOf(
      tokenlockData,
      timelockData,
      tsNow
    );

    const investorTokenAccountPubkey =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(investor.publicKey);
    const timelockIdx = 0;
    const reclaimerTokenAccountPubkey =
      testEnvironment.mintHelper.getAssocciatedTokenAddress(
        testEnvironment.reserveAdmin.publicKey
      );
    const cancelTimelockInstruction =
      tokenlockProgram.instruction.cancelTimelock(timelockIdx, {
        accounts: {
          tokenlockAccount: tokenlockDataPubkey,
          timelockAccount,
          escrowAccount: escrowAccount,
          pdaAccount: escrowOwnerPubkey,
          target: investor.publicKey,
          targetAssoc: investorTokenAccountPubkey,
          authority: testEnvironment.reserveAdmin.publicKey,
          reclaimer: reclaimerTokenAccountPubkey,
          mintAddress: testEnvironment.mintKeypair.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        },
        signers: [testEnvironment.reserveAdmin],
      });

    const lockedUntil = new anchor.BN(tsNow);
    const escrowGroupdId = new anchor.BN(2);
    const reclaimerGroupId = new anchor.BN(1);
    await testEnvironment.transferRestrictionsHelper.initializeTransferRule(
      lockedUntil,
      escrowGroupdId,
      reclaimerGroupId,
      testEnvironment.accessControlHelper.walletRolePDA(
        testEnvironment.transferAdmin.publicKey
      )[0],
      testEnvironment.transferAdmin
    );

    const mintInfo = await testEnvironment.mintHelper.getMint();
    const transferHook = getTransferHook(mintInfo);
    assert.ok(transferHook);

    await addExtraAccountMetasForExecute(
      testEnvironment.connection,
      cancelTimelockInstruction,
      transferHook.programId,
      escrowAccount,
      testEnvironment.mintKeypair.publicKey,
      reclaimerTokenAccountPubkey,
      escrowOwnerPubkey,
      transferAmount,
      testEnvironment.confirmOptions
    );

    await addExtraAccountMetasForExecute(
      testEnvironment.connection,
      cancelTimelockInstruction,
      transferHook.programId,
      escrowAccount,
      testEnvironment.mintKeypair.publicKey,
      investorTokenAccountPubkey,
      escrowOwnerPubkey,
      transferAmount,
      testEnvironment.confirmOptions
    );

    const modifyComputeUnitsInstruction =
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 400000,
      });

    const transferTxSignature = await sendAndConfirmTransaction(
      testEnvironment.connection,
      new Transaction().add(
        ...[modifyComputeUnitsInstruction, cancelTimelockInstruction]
      ),
      [testEnvironment.reserveAdmin],
      { commitment: testEnvironment.confirmOptions }
    );
    console.log("Cancel Timelock Transaction Signature", transferTxSignature);

    const timelockDataAfterTransfer =
      await tokenlockProgram.account.timelockData.fetch(timelockAccount);
    assert.equal(
      timelockDataAfterTransfer.timelocks[0].tokensTransferred.toNumber(),
      timelockDataAfterTransfer.timelocks[0].totalAmount.toNumber()
    );
    const investorTokenAccountData =
      await testEnvironment.mintHelper.getAccount(investorTokenAccountPubkey);
    assert.equal(
      investorTokenAccountData.amount.toString(),
      ((initialReleasePortionInBips * fundedAmount) / BIPS_PRECISION).toString()
    );
    const escrowAccountData = await testEnvironment.mintHelper.getAccount(
      escrowAccount
    );
    assert.equal(escrowAccountData.amount.toString(), "0");
  });
});
