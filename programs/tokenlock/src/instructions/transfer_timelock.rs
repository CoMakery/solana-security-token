use anchor_lang::{prelude::*, Discriminator};
use anchor_spl::token::{Token, TokenAccount};
use solana_program::program_memory::sol_memcmp;

use crate::{
    transfer_spl_from_escrow, utils, TimelockData, TokenLockData, TokenLockDataWrapper,
    TokenlockErrors,
};

#[derive(Accounts)]
pub struct TransferTimelock<'info> {
    /// CHECK: implemented own serialization in order to save compute units
    pub tokenlock_account: AccountInfo<'info>,

    #[account(mut,
        constraint = timelock_account.tokenlock_account == *tokenlock_account.key,
    )]
    pub timelock_account: Account<'info, TimelockData>,

    #[account(mut)]
    pub escrow_account: Account<'info, TokenAccount>,
    /// CHECK: Escrow account authority
    pub pda_account: AccountInfo<'info>,

    #[account(mut,
        constraint = *authority.key == timelock_account.target_account
    )]
    pub authority: Signer<'info>,

    #[account(mut,
        constraint = *to.to_account_info().owner == *token_program.key,
        constraint = escrow_account.mint == to.mint
    )]
    pub to: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn transfer_timelock(
    ctx: Context<TransferTimelock>,
    value: u64,
    timelock_id: u32,
) -> Result<()> {
    if value == 0 {
        return Err(TokenlockErrors::AmountMustBeBiggerThanZero.into());
    }

    let timelock_account = &mut ctx.accounts.timelock_account;
    let tokenlock_account = &ctx.accounts.tokenlock_account;
    let tokenlock_account_data = tokenlock_account.try_borrow_data()?;
    let discriminator = TokenLockData::discriminator();
    if sol_memcmp(&discriminator, &tokenlock_account_data, discriminator.len()) != 0 {
        return Err(TokenlockErrors::IncorrectTokenlockAccount.into());
    }

    //constraint
    let mint_address = TokenLockDataWrapper::mint_address(&tokenlock_account_data);
    let escrow_account = TokenLockDataWrapper::escrow_account(&tokenlock_account_data);

    if escrow_account != *ctx.accounts.escrow_account.to_account_info().key {
        return Err(TokenlockErrors::MisMatchedEscrow.into());
    }
    if mint_address != ctx.accounts.to.mint {
        return Err(TokenlockErrors::MisMatchedToken.into());
    }

    let now_ts = utils::get_unix_timestamp();

    if timelock_account.unlocked_balance_of_timelock(timelock_id, &tokenlock_account_data, now_ts)
        < value
    {
        return Err(TokenlockErrors::AmountBiggerThanUnlocked.into());
    }

    let timelock = timelock_account.get_timelock_mut(timelock_id).unwrap();
    let total_transfered_new = timelock.tokens_transferred.checked_add(value).unwrap();

    //transfer
    transfer_spl_from_escrow(
        &ctx.accounts.escrow_account.to_account_info(),
        &ctx.accounts.to.to_account_info(),
        &ctx.accounts.pda_account,
        &ctx.accounts.token_program,
        value,
        &mint_address,
        tokenlock_account.key,
        TokenLockDataWrapper::bump_seed(&tokenlock_account_data),
    )?;
    timelock.tokens_transferred = total_transfered_new;

    Ok(())
}