import {
  Connection,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';

import { BinaryReader } from 'borsh';

class Clock {
  slot = 0;
  epoch_start_timestamp = 0;
  epoch = 0;
  leader_schedule_epoch = 0;
  unix_timestamp = 0;

  deser(buffer) {
    const reader = new BinaryReader(buffer);
    this.slot = reader.readU64().toNumber();
    this.epoch_start_timestamp = reader.readU64().toNumber();
    this.epoch = reader.readU64().toNumber();
    this.leader_schedule_epoch = reader.readU64().toNumber();
    this.unix_timestamp = reader.readU64().toNumber();
  }
}

export async function getNowTs(connection: Connection) {
  const accountInfo = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
  const clock = new Clock();
  clock.deser(accountInfo.data);
  return clock.unix_timestamp;
}
