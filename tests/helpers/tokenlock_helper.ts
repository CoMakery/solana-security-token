import { v4 as uuidv4 } from "uuid";
import { sha256 } from "js-sha256";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
  Transaction,
  Connection,
} from "@solana/web3.js";
import { BN, Program } from "@coral-xyz/anchor";
import { Tokenlock } from "../../target/types/tokenlock";
import {
  addExtraAccountMetasForExecute,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";
import { TransferRestrictionsHelper } from "./transfer-restrictions_helper";

export function uuidBytes(): number[] {
  const uuid = uuidv4().replace(/-/g, "");
  const bytes: number[] = [];
  for (let c = 0; c < uuid.length; c += 2) {
    bytes.push(parseInt(uuid.substr(c, 2), 16));
  }

  return bytes;
}

export function calcSignerHash(key: PublicKey, uuid: number[]) {
  const signerData = Array.from(key.toBuffer()).concat(uuid);
  return sha256.array(signerData).slice(0, 20);
}

export function compareSignerHash(hash1, hash2) {
  if (hash1.length !== hash2.length) return false;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) return false;
  }
  return true;
}

function parseErrorNumber(errors, logs) {
  const key = "custom program error: ";
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].indexOf(key) >= 0) {
      const idxStart = logs[i].indexOf(key);
      const numStr = logs[i].substring(idxStart + key.length);
      const errorNum = Number(numStr);
      const idx = errorNum % 100;
      return errors[idx].msg;
    }
  }
  return undefined;
}

export function getTimelockAccount(
  programId: PublicKey,
  tokenlockAccount: PublicKey,
  target: PublicKey
): PublicKey {
  const [timelockAccount] = PublicKey.findProgramAddressSync(
    [tokenlockAccount.toBuffer(), target.toBuffer()],
    programId
  );
  return timelockAccount;
}

/**
 * Get the timelock object form timelockAccountData
 * @param {Object} timelockAccount - hold data about timelock
 * @param {*} timelockId - timelock index
 * @returns {Object} timelock object, otherwise throw exception
 */
export function timelockOf(timelockAccount: any, timelockId: number): any {
  if (timelockId < timelockAccount.timelocks.length) {
    return timelockAccount.timelocks[timelockId];
  }

  throw new Error("Timelock index out of range");
}

/**
 * Get count of added timelocks in account
 */
function timelockCountOf(timelockAccount: any): number {
  if (timelockAccount === null) {
    return 0;
  }

  return timelockAccount.timelocks.length;
}

function checkAndgetTimelock(timelockAccount: any, timelockIndex: number): any {
  if (timelockAccount === null) {
    return null;
  }

  const timelock = timelockOf(timelockAccount, timelockIndex);
  if (timelock == null) {
    return null;
  }

  if (
    timelock.totalAmount.toNumber() <= timelock.tokensTransferred.toNumber()
  ) {
    return null;
  }

  return timelock;
}

function getReleaseSchedule(account: any, scheduleId: number): any {
  if (scheduleId >= account.releaseSchedules.length) return null;
  return account.releaseSchedules[scheduleId];
}

/**
 * Calculate unlocked amount for specific time and release schedule
 */
function calculateUnlocked(
  commencementTimestamp: number,
  currentTimestamp: number,
  amount: BN,
  releaseSchedule: any
): BN {
  return calculateUnlockedForReleaseSchedule(
    commencementTimestamp,
    currentTimestamp,
    amount,
    releaseSchedule.releaseCount,
    releaseSchedule.delayUntilFirstReleaseInSeconds.toNumber(),
    releaseSchedule.initialReleasePortionInBips,
    releaseSchedule.periodBetweenReleasesInSeconds.toNumber()
  );
}

/**
 * Calculate total unlocked amount for specific timelock id
 * Already transfered part is included
 */
function totalUnlockedToDateOfTimelock(
  account: any,
  timelockAccount: any,
  timelockId: number,
  nowTs: number
): BN {
  if (timelockAccount === null) {
    return new BN(0);
  }

  const timelock = timelockOf(timelockAccount, timelockId);
  if (timelock == null) return new BN(0);
  const releaseSchedule = getReleaseSchedule(account, timelock.scheduleId);

  if (releaseSchedule == null) return new BN(0);

  return calculateUnlocked(
    timelock.commencementTimestamp,
    nowTs,
    timelock.totalAmount,
    releaseSchedule
  );
}

/**
 * Calculate unlocked amount which can be withdrawal for specific timelock id
 */
export function unlockedBalanceOfTimelock(
  account: any,
  timelockAccount: any,
  timelockIndex: number,
  nowTs: number
): BN {
  const timelock = checkAndgetTimelock(timelockAccount, timelockIndex);
  if (timelock === null) return new BN(0);

  return totalUnlockedToDateOfTimelock(
    account,
    timelockAccount,
    timelockIndex,
    nowTs
  ).sub(timelock.tokensTransferred);
}

/**
 * Calculate locked amount which can be withdrawal in future for specific timelock index
 */
function lockedBalanceOfTimelock(
  account: any,
  timelockAccount: any,
  timelockIndex: number,
  nowTs: number
): BN {
  const timelock = checkAndgetTimelock(timelockAccount, timelockIndex);
  if (timelock === null) return null;

  return timelock.totalAmount.sub(
    totalUnlockedToDateOfTimelock(
      account,
      timelockAccount,
      timelockIndex,
      nowTs
    )
  );
}

/**
 * Calculate total amount which can be withdrawal for all timelocks
 */
export function unlockedBalanceOf(
  account: any,
  timelockAccount: any,
  nowTs: number
): BN {
  if (timelockAccount === null) {
    return new BN(0);
  }

  let amount = new BN(0);
  const timelockCount = timelockAccount.timelocks.length;
  for (let i = 0; i < timelockCount; i++) {
    amount = amount.add(unlockedBalanceOfTimelock(account, timelockAccount, i, nowTs));
  }
  return amount;
}

/**
 * Calculate total locked amount which can be withdrawal in future for all timelocks
 */
export function lockedBalanceOf(
  account: any,
  timelockAccount: any,
  nowTs: number
): BN {
  if (timelockAccount === null) {
    return new BN(0);
  }

  let amount = new BN(0);
  const timelockCount = timelockCountOf(timelockAccount);
  for (let i = 0; i < timelockCount; i++) {
    amount = amount.add(lockedBalanceOfTimelock(account, timelockAccount, i, nowTs));
  }
  return amount;
}

export const BIPS_PRECISION: number = 10000;

function calculateUnlockedForReleaseSchedule(
  commencementTimestamp: number,
  currentTimestamp: number,
  amount: BN,
  releaseCount: number,
  delayUntilFirstReleaseInSeconds: number,
  initialReleasePortionInBips: number,
  periodBetweenReleasesInSeconds: number
): BN {
  if (commencementTimestamp > currentTimestamp) return new BN(0);

  const secondsElapsed = currentTimestamp - commencementTimestamp;

  // return the full amount if the total lockup period has expired
  // unlocked amounts in each period are truncated and round down remainders smaller than the smallest unit
  // unlocking the full amount unlocks any remainder amounts in the final unlock period
  // this is done first to reduce computation
  if (
    secondsElapsed >=
    delayUntilFirstReleaseInSeconds +
    periodBetweenReleasesInSeconds * (releaseCount - 1)
  ) {
    return amount;
  }

  let unlocked = new BN(0);
  // unlock the initial release if the delay has elapsed
  if (secondsElapsed >= delayUntilFirstReleaseInSeconds) {
    unlocked = (amount.muln(initialReleasePortionInBips)).divn(BIPS_PRECISION)

    const timePassedAfterFirstReleaseInSeconds = secondsElapsed - delayUntilFirstReleaseInSeconds;
    // if at least one period after the delay has passed
    if (
      timePassedAfterFirstReleaseInSeconds >=
      periodBetweenReleasesInSeconds
    ) {
      // calculate the number of additional periods that have passed (not including the initial release)
      // this discards any remainders (ie it truncates / rounds down)
      // eslint-disable-next-line max-len
      const additionalUnlockedPeriods = Math.floor(
        timePassedAfterFirstReleaseInSeconds /
        periodBetweenReleasesInSeconds
      );

      // calculate the amount of unlocked tokens for the additionalUnlockedPeriods
      // multiplication is applied before division to delay truncating to the smallest unit
      // this distributes unlocked tokens more evenly across unlock periods
      // than truncated division followed by multiplication
      const amountMulAdditionalReleasePeriods = (amount.sub(unlocked)).muln(additionalUnlockedPeriods);
      const unlockedAmountAfterFirstRelease = amountMulAdditionalReleasePeriods.divn(releaseCount - 1);

      unlocked = unlocked.add(unlockedAmountAfterFirstRelease);
    }
  }

  return unlocked;
}

export async function initializeTokenlock(
  program: Program<Tokenlock>,
  maxReleaseDelay: BN,
  minTimelockAmount: BN,
  tokenlockAccount: PublicKey,
  escrow: PublicKey,
  transferRestrictionsPubkey: PublicKey,
  mintPubkey: PublicKey,
  authorityWalletRolePubkey: PublicKey,
  accessControlPubkey: PublicKey,
  signer: Keypair
): Promise<string> {
  return program.rpc.initializeTokenlock(maxReleaseDelay, minTimelockAmount, {
    accounts: {
      tokenlockAccount,
      transferRestrictionsData: transferRestrictionsPubkey,
      escrowAccount: escrow,
      mintAddress: mintPubkey,
      authorityWalletRole: authorityWalletRolePubkey,
      accessControl: accessControlPubkey,
      authority: signer.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    },
    signers: [signer],
  });
}

export async function createReleaseSchedule(
  program: Program<Tokenlock>,
  tokenlockDataPubkey: PublicKey,
  releaseCount: number,
  delayUntilFirstReleaseInSeconds: BN,
  initialReleasePortionInBips: number,
  periodBetweenReleasesInSeconds: BN,
  accessControlPubkey: PublicKey,
  authorityWalletRolePubkey: PublicKey,
  signer: Keypair
): Promise<string | number> {
  const uuid = uuidBytes();
  const signerHash = calcSignerHash(signer.publicKey, uuid);
  let result;

  try {
    await program.rpc.createReleaseSchedule(
      uuid,
      releaseCount,
      delayUntilFirstReleaseInSeconds,
      initialReleasePortionInBips,
      periodBetweenReleasesInSeconds,
      {
        accounts: {
          tokenlockAccount: tokenlockDataPubkey,
          authority: signer.publicKey,
          authorityWalletRole: authorityWalletRolePubkey,
          accessControl: accessControlPubkey,
        },
        signers: [signer],
      }
    );
    const account = await program.account.tokenLockData.fetch(
      tokenlockDataPubkey
    );
    // check contents
    for (let i = account.releaseSchedules.length - 1; i >= 0; i--) {
      if (
        compareSignerHash(account.releaseSchedules[i].signerHash, signerHash) &&
        account.releaseSchedules[i].releaseCount === releaseCount &&
        // eslint-disable-next-line max-len
        account.releaseSchedules[
          i
        ].delayUntilFirstReleaseInSeconds.toString() ===
        delayUntilFirstReleaseInSeconds.toString() &&
        account.releaseSchedules[i].initialReleasePortionInBips ===
        initialReleasePortionInBips &&
        // eslint-disable-next-line max-len
        account.releaseSchedules[
          i
        ].periodBetweenReleasesInSeconds.toString() ===
        periodBetweenReleasesInSeconds.toString()
      ) {
        result = i;
        break;
      }
    }
  } catch (e) {
    if (!e.error || !e.transactionLogs) {
      result = parseErrorNumber(program.idl.errors, e.transactionLogs);
    } else result = e.error.errorMessage;
  }

  return result;
}

export async function initializeTimelock(
  program: Program<Tokenlock>,
  tokenlockAccount: PublicKey,
  targetAccount: PublicKey,
  accessControl: PublicKey,
  authorityWalletRole: PublicKey,
  signer: Keypair
): Promise<PublicKey> {
  const timelockAccount = getTimelockAccount(
    program.programId,
    tokenlockAccount,
    targetAccount
  );
  await program.rpc.initializeTimelock({
    accounts: {
      tokenlockAccount,
      timelockAccount: timelockAccount,
      authorityWalletRole,
      accessControl,
      authority: signer.publicKey,
      targetAccount,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    },
    signers: [signer],
  });

  return timelockAccount;
}

export async function mintReleaseSchedule(
  connection: Connection,
  program: Program<Tokenlock>,
  amount: BN,
  commencementTimestamp: BN,
  scheduleId: number,
  cancelableBy: PublicKey[],
  tokenlockAccount: PublicKey,
  escrowAccount: PublicKey,
  escrowAccountOwnerPubkey: PublicKey,
  to: PublicKey,
  signer: Keypair,
  authorityWalletRolePubkey: PublicKey,
  accessControlPubkey: PublicKey,
  mintPubkey: PublicKey,
  accessControlProgramId: PublicKey
): Promise<number | string> {
  const timelockAccount = getTimelockAccount(
    program.programId,
    tokenlockAccount,
    to
  );
  let accInfo = await program.provider.connection.getAccountInfo(
    timelockAccount
  );

  if (accInfo === null) {
    await initializeTimelock(
      program,
      tokenlockAccount,
      to,
      accessControlPubkey,
      authorityWalletRolePubkey,
      signer
    );
  }
  const uuid = uuidBytes();
  const signerHash = calcSignerHash(signer.publicKey, uuid);
  const cancelByCount = cancelableBy.length;
  const cancelBy = [];
  for (let i = 0; i < cancelByCount; i++) cancelBy.push(cancelableBy[i]);

  let result: number | string;
  try {
    const modifyComputeUnitsInstruction =
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 400000,
      });
    const mintReleaseScheduleInstruction =
      program.instruction.mintReleaseSchedule(
        uuid,
        amount,
        commencementTimestamp,
        scheduleId,
        cancelableBy,
        {
          accounts: {
            tokenlockAccount: tokenlockAccount,
            timelockAccount: timelockAccount,
            escrowAccount: escrowAccount,
            escrowAccountOwner: escrowAccountOwnerPubkey,
            authorityWalletRole: authorityWalletRolePubkey,
            accessControl: accessControlPubkey,
            mintAddress: mintPubkey,
            to,
            authority: signer.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            accessControlProgram: accessControlProgramId,
          },
          signers: [signer],
        }
      );

    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        ...[modifyComputeUnitsInstruction, mintReleaseScheduleInstruction]
      ),
      [signer],
    );

    const account = await program.account.timelockData.fetch(timelockAccount);
    for (let i = account.timelocks.length - 1; i >= 0; i--) {
      if (
        compareSignerHash(account.timelocks[i].signerHash, signerHash) &&
        account.timelocks[i].totalAmount.toString() === amount.toString() &&
        account.timelocks[i].scheduleId === scheduleId &&
        account.timelocks[i].commencementTimestamp.toString() ===
        commencementTimestamp.toString()
      ) {
        result = i;
        break;
      }
    }
  } catch (e) {
    console.log("error:", e);

    if (!e.error || !e.transactionLogs) {
      result = parseErrorNumber(program.idl.errors, e.transactionLogs);
    } else result = e.error.errorMessage;
  }
  console.log("result:", result);
  return result;
}

export async function withdraw(
  connection: Connection,
  amount: BN,
  program: Program<Tokenlock>,
  transferHookProgramId: PublicKey,
  mintPubkey: PublicKey,
  tokenlockAccount: PublicKey,
  timelockAccount: PublicKey,
  escrowOwnerPubkey: PublicKey,
  recipientAccount: PublicKey,
  transferRestrictionsHelper: TransferRestrictionsHelper,
  signer: Keypair,
): Promise<string> {
  const escrowAccount = getAssociatedTokenAddressSync(mintPubkey, escrowOwnerPubkey, true, TOKEN_2022_PROGRAM_ID);
  const authorityAccount = getAssociatedTokenAddressSync(mintPubkey, signer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const securityAssociatedAccountFrom = transferRestrictionsHelper.securityAssociatedAccountPDA(authorityAccount)[0];
  const securityAssociatedAccountTo = transferRestrictionsHelper.securityAssociatedAccountPDA(recipientAccount)[0];
  const secAssocAccountFromData = await transferRestrictionsHelper.securityAssociatedAccountData(securityAssociatedAccountFrom);
  const secAssocAccountToData = await transferRestrictionsHelper.securityAssociatedAccountData(securityAssociatedAccountTo);
  const [transferRulePubkey] = transferRestrictionsHelper.transferRulePDA(
    secAssocAccountFromData.group,
    secAssocAccountToData.group
  );
  const transferInstruction = program.instruction.transfer(
    amount,
    {
      accounts: {
        tokenlockAccount,
        timelockAccount,
        escrowAccount,
        pdaAccount: escrowOwnerPubkey,
        authority: signer.publicKey,
        to: recipientAccount,
        mintAddress: mintPubkey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        transferRestrictionsProgram: transferRestrictionsHelper.program.programId,
        authorityAccount,
        securityAssociatedAccountFrom,
        securityAssociatedAccountTo,
        transferRule: transferRulePubkey,
      },
      signers: [signer],
    }
  );


  await addExtraAccountMetasForExecute(
    connection,
    transferInstruction,
    transferHookProgramId,
    escrowAccount,
    mintPubkey,
    recipientAccount,
    escrowOwnerPubkey,
    BigInt(amount.toString()),
    "confirmed"
  );

  const modifyComputeUnitsInstruction =
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000,
    });

  return sendAndConfirmTransaction(
    connection,
    new Transaction().add(modifyComputeUnitsInstruction, transferInstruction),
    [signer],
    { commitment: "confirmed" }
  );
}