use anchor_lang::prelude::*;

pub mod error;
pub use error::TokenlockErrors;

pub mod instructions;
use instructions::*;

pub mod states;
use states::*;

pub mod common;

pub mod utils;
pub mod wrappers;

use crate::utils::*;
use crate::wrappers::*;

declare_id!("7CN3iHcRimZRa97M38cyMQAF68ecQYDqHfCUgBeSARG2");

#[program]
mod tokenlock {
    use super::*;

    pub fn initialize_tokenlock(
        ctx: Context<InitializeTokenLock>,
        max_release_delay: u64,
        min_timelock_amount: u64,
    ) -> Result<()> {
        instructions::initialize_tokenlock(ctx, max_release_delay, min_timelock_amount)
    }

    pub fn initialize_timelock(ctx: Context<InitializeTimeLock>) -> Result<()> {
        instructions::initialize_timelock(ctx)
    }

    pub fn create_release_schedule(
        ctx: Context<ManagementTokenlock>,
        uuid: [u8; 16],
        release_count: u32,
        delay_until_first_release_in_seconds: u64,
        initial_release_portion_in_bips: u32,
        period_between_releases_in_seconds: u64,
    ) -> Result<()> {
        instructions::create_release_schedule(
            ctx,
            uuid,
            release_count,
            delay_until_first_release_in_seconds,
            initial_release_portion_in_bips,
            period_between_releases_in_seconds,
        )
    }

    pub fn fund_release_schedule<'info>(
        ctx: Context<'_, '_, '_, 'info, FundReleaseSchedule<'info>>,
        uuid: [u8; 16],
        amount: u64,
        commencement_timestamp: u64,
        schedule_id: u16,
        cancelable_by: Vec<Pubkey>,
    ) -> Result<()> {
        instructions::fund_release_schedule(
            ctx,
            uuid,
            amount,
            commencement_timestamp,
            schedule_id,
            cancelable_by,
        )
    }

    pub fn transfer<'info>(ctx: Context<'_, '_, '_, 'info, TransferFrom<'info>>, value: u64) -> Result<()> {
        instructions::transfer(ctx, value)
    }

    pub fn transfer_timelock<'info>(
        ctx: Context<'_, '_, '_, 'info, TransferTimelock<'info>>,
        value: u64,
        timelock_id: u32,
    ) -> Result<()> {
        instructions::transfer_timelock(ctx, value, timelock_id)
    }

    pub fn cancel_timelock(ctx: Context<CancelTimelock>, timelock_id: u32) -> Result<()> {
        instructions::cancel_timelock(ctx, timelock_id)
    }
}

#[cfg(test)]
mod test;
