use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_memory::sol_memcpy;

use crate::{ReleaseSchedule, TokenLockData};

pub struct BinaryOperation {}

impl BinaryOperation {
    pub fn key_write(data: &mut [u8], offset: usize, key: &Pubkey) -> () {
        let bytes = key.as_ref();
        sol_memcpy(&mut data[offset..offset + bytes.len()], &bytes, bytes.len());
    }
    pub fn u8_write(data: &mut [u8], offset: usize, val: u8) -> () {
        data[offset] = val;
    }
    pub fn u16_write(data: &mut [u8], offset: usize, val: u16) -> () {
        let bytes = val.to_le_bytes();
        sol_memcpy(&mut data[offset..offset + bytes.len()], &bytes, bytes.len());
    }
    pub fn u32_write(data: &mut [u8], offset: usize, val: u32) -> () {
        let bytes = val.to_le_bytes();
        sol_memcpy(&mut data[offset..offset + bytes.len()], &bytes, bytes.len());
    }
    pub fn u64_write(data: &mut [u8], offset: usize, val: u64) -> () {
        let bytes = val.to_le_bytes();
        sol_memcpy(&mut data[offset..offset + bytes.len()], &bytes, bytes.len());
    }

    //reading
    pub fn key_read(data: &[u8], offset: usize) -> Pubkey {
        let key = Pubkey::try_from_slice(&data[offset..offset + 32]).unwrap();
        return key;
    }

    pub fn u8_read(data: &[u8], offset: usize) -> u8 {
        return data[offset];
    }
    pub fn u16_read(data: &[u8], offset: usize) -> u16 {
        let mut bytes: [u8; 2] = [0; 2];
        sol_memcpy(&mut bytes, &data[offset..], 2);

        return u16::from_le_bytes(bytes);
    }
    pub fn u32_read(data: &[u8], offset: usize) -> u32 {
        let mut bytes: [u8; 4] = [0; 4];
        sol_memcpy(&mut bytes, &data[offset..], 4);

        return u32::from_le_bytes(bytes);
    }
    pub fn u64_read(data: &[u8], offset: usize) -> u64 {
        let mut bytes: [u8; 8] = [0; 8];
        sol_memcpy(&mut bytes, &data[offset..], 8);

        return u64::from_le_bytes(bytes);
    }
}

pub struct ReleaseScheduleWrap {}
impl ReleaseScheduleWrap {
    pub fn read(data: &[u8], offset: usize) -> ReleaseSchedule {
        let schedule =
            ReleaseSchedule::try_from_slice(&data[offset..offset + ReleaseSchedule::DEFAULT_SIZE])
                .unwrap();
        return schedule;
    }

    pub fn write(data: &mut [u8], offset: usize, schedule: &ReleaseSchedule) -> () {
        let new_data = schedule.try_to_vec().unwrap();
        sol_memcpy(
            &mut data[offset..offset + new_data.len()],
            &new_data,
            new_data.len(),
        );
    }
}

pub struct TokenLockDataWrapper {}

impl TokenLockDataWrapper {
    pub fn free_space(account_data: &[u8]) -> Option<usize> {
        return account_data
            .len()
            .checked_sub(Self::used_space(account_data)?);
    }
    pub fn used_space(account_data: &[u8]) -> Option<usize> {
        let schedule_count = Self::schedule_count(account_data);
        return TokenLockData::RELEASE_SCHEDULE_START_OFFSET
            .checked_add(ReleaseSchedule::DEFAULT_SIZE.checked_mul(schedule_count as usize)?);
    }
    pub fn access_control(account_data: &[u8]) -> Pubkey {
        return BinaryOperation::key_read(account_data, TokenLockData::ACCESS_CONTROL_OFFSET);
    }
    pub fn mint_address(account_data: &[u8]) -> Pubkey {
        return BinaryOperation::key_read(account_data, TokenLockData::MINT_ADDRESS_OFFSET);
    }
    pub fn escrow_account(account_data: &[u8]) -> Pubkey {
        return BinaryOperation::key_read(account_data, TokenLockData::ESCROW_ACCOUNT_OFFSET);
    }
    pub fn bump_seed(account_data: &[u8]) -> u8 {
        return BinaryOperation::u8_read(account_data, TokenLockData::BUMP_SEED_OFFSET);
    }

    pub fn max_release_delay(account_data: &[u8]) -> u64 {
        return BinaryOperation::u64_read(account_data, TokenLockData::MAX_RELEASE_DELAY_OFFSET);
    }
    pub fn min_timelock_amount(account_data: &[u8]) -> u64 {
        return BinaryOperation::u64_read(account_data, TokenLockData::MIN_TIMELOCK_AMOUNT_OFFSET);
    }

    pub fn schedule_count(account_data: &[u8]) -> u16 {
        return BinaryOperation::u16_read(account_data, TokenLockData::RELEASE_SCHEDULE_COUNT_OFFSET);
    }

    pub fn update_schedule_count(data: &mut [u8], count: u16) -> () {
        return BinaryOperation::u16_write(
            data,
            TokenLockData::RELEASE_SCHEDULE_COUNT_OFFSET,
            count,
        );
    }

    pub fn get_schedule(account_data: &[u8], id: u16) -> Option<ReleaseSchedule> {
        let schedule_count = Self::schedule_count(account_data);
        if id >= schedule_count {
            return None;
        }
        return Some(ReleaseScheduleWrap::read(
            account_data,
            TokenLockData::RELEASE_SCHEDULE_START_OFFSET
                .checked_add((id as usize).checked_mul(ReleaseSchedule::DEFAULT_SIZE)?)?,
        ));
    }

    pub fn get_last_schedule(account_data: &[u8]) -> Option<ReleaseSchedule> {
        let schedule_count = Self::schedule_count(account_data);
        if schedule_count == 0 {
            return None;
        }
        return Self::get_schedule(account_data, schedule_count - 1);
    }

    pub fn add_schedule(account_data: &mut [u8], schedule: &ReleaseSchedule) -> Option<u16> {
        let schedule_count = Self::schedule_count(account_data);
        let schedule_offset = TokenLockData::RELEASE_SCHEDULE_START_OFFSET
            .checked_add(
                (schedule_count as usize)
                    .checked_mul(ReleaseSchedule::DEFAULT_SIZE)?,
            )?;
        //write schedule
        ReleaseScheduleWrap::write(account_data, schedule_offset, schedule);

        //update schedule count
        let schedule_count_new = schedule_count.checked_add(1)?;
        Self::update_schedule_count(account_data, schedule_count_new);

        Some(schedule_count_new)
    }
}
