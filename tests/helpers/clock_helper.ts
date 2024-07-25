import { BN } from "@coral-xyz/anchor";
import { Connection, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";

export class Clock {
  slot: bigint;
  epochStartTimestamp: bigint;
  epoch: bigint;
  leaderScheduleEpoch: bigint;
  unixTimestamp: bigint;

  deserialize(buffer: Buffer) {
    this.slot = buffer.readBigInt64LE(0);
    this.epochStartTimestamp = buffer.readBigInt64LE(8);
    this.epoch = buffer.readBigInt64LE(16);
    this.leaderScheduleEpoch = buffer.readBigInt64LE(24);
    this.unixTimestamp = buffer.readBigInt64LE(8);
  }
}

export async function getNowTs(connection: Connection): Promise<number> {
  const accountInfo = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);

  const timestampBuffer = accountInfo.data.slice(8, 16);
  const timestamp = new BN(timestampBuffer, "le").toNumber();

  return timestamp;
}
