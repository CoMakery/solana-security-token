import { v4 as uuidv4 } from 'uuid';
import { sha256 } from 'js-sha256';
import {
  PublicKey
} from "@solana/web3.js";


export function uuidBytes(): number[] {
  const uuid = uuidv4().replace(/-/g, '');
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

export function getTimelockAccount(programId: PublicKey, tokenlockAccount: PublicKey, target: PublicKey): PublicKey {
  const [timelockAccount] = PublicKey.findProgramAddressSync(
      [tokenlockAccount.toBuffer(), target.toBuffer()],
      programId,
  );
  return timelockAccount;
}

/**
 * Get the timelock object form timelockAccountData
 * @param {Object} timelockAccount - hold data about timelock
 * @param {*} timelockId - timelock index
 * @returns {Object} timelock object, otherwise throw exception
 */
export function timelockOf(
  timelockAccount: any,
  timelockId: number
): any {
  if (timelockId < timelockAccount.timelocks.length) {
      return timelockAccount.timelocks[timelockId];
  }

  throw new Error('Timelock index out of range');
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

  if (timelock.totalAmount.toNumber() <= timelock.tokensTransferred.toNumber()) {
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
  amount: number,
  releaseSchedule: any
): number {
  return calculateUnlockedForReleaseSchedule(
      commencementTimestamp,
      currentTimestamp,
      amount,
      releaseSchedule.releaseCount,
      releaseSchedule.delayUntilFirstReleaseInSeconds.toNumber(),
      releaseSchedule.initialReleasePortionInBips,
      releaseSchedule.periodBetweenReleasesInSeconds.toNumber(),
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
) {
  if (timelockAccount === null) {
      return 0;
  }

  const timelock = timelockOf(timelockAccount, timelockId);
  if (timelock == null) return 0;
  const releaseSchedule = getReleaseSchedule(account, timelock.scheduleId);
  
  if (releaseSchedule == null) return 0;
  return calculateUnlocked(timelock.commencementTimestamp, nowTs, timelock.totalAmount.toNumber(), releaseSchedule);
}

/**
 * Calculate unlocked amount which can be withdrawal for specific timelock id
 */
export function unlockedBalanceOfTimelock(
  account: any,
  timelockAccount: any,
  timelockIndex: number,
  nowTs: number
): number {
  const timelock = checkAndgetTimelock(timelockAccount, timelockIndex);
  if (timelock === null) return null;

  return totalUnlockedToDateOfTimelock(account, timelockAccount, timelockIndex, nowTs)
      - timelock.tokensTransferred.toNumber();
}

/**
 * Calculate locked amount which can be withdrawal in future for specific timelock index
 */
function lockedBalanceOfTimelock(
  account: any,
  timelockAccount: any,
  timelockIndex: number,
  nowTs: number
) {
  const timelock = checkAndgetTimelock(timelockAccount, timelockIndex);
  if (timelock === null) return null;

  return timelock.totalAmount.toNumber() - totalUnlockedToDateOfTimelock(account, timelockAccount, timelockIndex, nowTs);
}

/**
 * Calculate total amount which can be withdrawal for all timelocks
 */
export function unlockedBalanceOf(
  account: any,
  timelockAccount: any,
  nowTs: number
): number {
  if (timelockAccount === null) {
      return 0;
  }

  let amount = 0;
  const timelockCount = timelockAccount.timelocks.length;
  for (let i = 0; i < timelockCount; i++) {
      amount += unlockedBalanceOfTimelock(account, timelockAccount, i, nowTs);
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
): number {
  if (timelockAccount === null) {
      return 0;
  }

  let amount = 0;
  const timelockCount = timelockCountOf(timelockAccount);
  for (let i = 0; i < timelockCount; i++) {
      amount += lockedBalanceOfTimelock(account, timelockAccount, i, nowTs);
  }
  return amount;
}

const BIPS_PRECISION: number = 10000;

function calculateUnlockedForReleaseSchedule(
  commencementTimestamp: number,
  currentTimestamp: number,
  amount: number,
  releaseCount: number,
  delayUntilFirstReleaseInSeconds: number,
  initialReleasePortionInBips: number,
  periodBetweenReleasesInSeconds: number,
): number {
  if (commencementTimestamp > currentTimestamp) return 0;

  const secondsElapsed = currentTimestamp - commencementTimestamp;

  // return the full amount if the total lockup period has expired
  // unlocked amounts in each period are truncated and round down remainders smaller than the smallest unit
  // unlocking the full amount unlocks any remainder amounts in the final unlock period
  // this is done first to reduce computation
  if (secondsElapsed >= delayUntilFirstReleaseInSeconds + (periodBetweenReleasesInSeconds * (releaseCount - 1))) {
      return amount;
  }

  let unlocked = 0;
  // unlock the initial release if the delay has elapsed
  if (secondsElapsed >= delayUntilFirstReleaseInSeconds) {
      unlocked = (amount * initialReleasePortionInBips) / BIPS_PRECISION;

      // if at least one period after the delay has passed
      if (secondsElapsed - delayUntilFirstReleaseInSeconds >= periodBetweenReleasesInSeconds) {
          // calculate the number of additional periods that have passed (not including the initial release)
          // this discards any remainders (ie it truncates / rounds down)
          // eslint-disable-next-line max-len
          const additionalUnlockedPeriods = (secondsElapsed - delayUntilFirstReleaseInSeconds) / periodBetweenReleasesInSeconds;

          // calculate the amount of unlocked tokens for the additionalUnlockedPeriods
          // multiplication is applied before division to delay truncating to the smallest unit
          // this distributes unlocked tokens more evenly across unlock periods
          // than truncated division followed by multiplication
          unlocked += ((amount - unlocked) * additionalUnlockedPeriods) / (releaseCount - 1);
      }
  }

  return unlocked;
}
