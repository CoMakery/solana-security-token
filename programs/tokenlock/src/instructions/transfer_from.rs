use anchor_lang::{prelude::*, Discriminator};
use anchor_spl::token::{Token, TokenAccount};
use solana_program::program_memory::sol_memcmp;

use crate::{
    transfer_spl_from_escrow, utils, TimelockData, TokenLockData, TokenLockDataWrapper,
    TokenlockErrors,
};

#[derive(Accounts)]
pub struct TransferFrom<'info> {
    /// CHECK: implemented own serialization in order to save compute units
    pub tokenlock_account: AccountInfo<'info>,

    #[account(mut,
        constraint = timelock_account.tokenlock_account == *tokenlock_account.key
    )]
    pub timelock_account: Account<'info, TimelockData>,

    #[account(mut)]
    pub escrow_account: Account<'info, TokenAccount>,
    /// CHECK: Escrow account authority
    pub pda_account: AccountInfo<'info>,

    #[account(mut,
        constraint = *authority.key == timelock_account.target_account,
    )]
    pub authority: Signer<'info>,

    #[account(mut,
        constraint = *to.to_account_info().owner == *token_program.key,
        constraint = escrow_account.mint == to.mint
    )]
    pub to: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn transfer(ctx: Context<TransferFrom>, value: u64) -> Result<()> {
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

    //check params
    let now_ts = utils::get_unix_timestamp();
    let mut remaining_transfer = value;

    if timelock_account
        .unlocked_balance_of(&tokenlock_account_data, now_ts)
        .unwrap()
        < value
    {
        return Err(TokenlockErrors::AmountBiggerThanUnlocked.into());
    }

    // transfer from unlocked tokens
    for id in 0..timelock_account.timelocks.len() {
        let unlocked = timelock_account.unlocked_balance_of_timelock(
            id as u32,
            &tokenlock_account_data,
            now_ts,
        );

        if let Some(timelock) = timelock_account.get_timelock_mut(id as u32) {
            // if the timelock has no value left
            if timelock.tokens_transferred == timelock.total_amount {
                continue;
            } else if remaining_transfer > unlocked {
                // if the remainingTransfer is more than the unlocked balance use it all
                remaining_transfer -= unlocked;
                timelock.tokens_transferred =
                    timelock.tokens_transferred.checked_add(unlocked).unwrap();
            } else {
                // if the remainingTransfer is less than or equal to the unlocked balance
                // use part or all and exit the loop
                timelock.tokens_transferred = timelock
                    .tokens_transferred
                    .checked_add(remaining_transfer)
                    .unwrap();
                remaining_transfer = 0;
                break;
            }
        }
    }

    if remaining_transfer != 0 {
        return Err(TokenlockErrors::BadTransfer.into());
    }

    // //transfer
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
    Ok(())
}