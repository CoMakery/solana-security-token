
use anchor_lang::prelude::*;

use crate::common::PUBKEY_SIZE;
use crate::ReleaseSchedule;

#[account]
#[derive(Default)]
pub struct TokenLockData {
    pub access_control: Pubkey,
    pub mint_address: Pubkey,
    pub escrow_account: Pubkey,
    pub transfer_restrictions_data: Pubkey,
    pub bump_seed: u8,
    pub max_release_delay: u64,
    pub min_timelock_amount: u64,
    pub release_schedules: Vec<ReleaseSchedule>,
}

impl TokenLockData {
    pub const MAX_SCHEDULE_COUNT: usize = 65535;

    pub const ACCESS_CONTROL_OFFSET: usize = 8;
    pub const MINT_ADDRESS_OFFSET: usize = Self::ACCESS_CONTROL_OFFSET + PUBKEY_SIZE;
    pub const ESCROW_ACCOUNT_OFFSET: usize = Self::MINT_ADDRESS_OFFSET + PUBKEY_SIZE;
    pub const TRANSFER_RESTRICTIONS_DATA_OFFSET: usize = Self::ESCROW_ACCOUNT_OFFSET + PUBKEY_SIZE;
    pub const BUMP_SEED_OFFSET: usize = Self::TRANSFER_RESTRICTIONS_DATA_OFFSET + PUBKEY_SIZE;
    pub const MAX_RELEASE_DELAY_OFFSET: usize = Self::BUMP_SEED_OFFSET + 1;
    pub const MIN_TIMELOCK_AMOUNT_OFFSET: usize = Self::MAX_RELEASE_DELAY_OFFSET + 8;

    pub const HEADERS_LEN: usize = Self::MIN_TIMELOCK_AMOUNT_OFFSET + 8;
    pub const RELEASE_SCHEDULE_COUNT_OFFSET: usize = Self::HEADERS_LEN;
    pub const RELEASE_SCHEDULE_START_OFFSET: usize = Self::HEADERS_LEN + 4;
}
