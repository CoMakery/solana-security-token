use anchor_lang::{prelude::*, Discriminator};
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};
use solana_program::program_memory::sol_memcmp;
use transfer_restrictions::cpi::accounts::EnforceTransferRestrictions;
use transfer_restrictions::program::TransferRestrictions;

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
    pub escrow_account: Box<InterfaceAccount<'info, TokenAccount>>,
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
    pub to: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program,
    )]
    pub mint_address: Box<InterfaceAccount<'info, Mint>>,

    pub token_program: Program<'info, Token2022>,

    pub transfer_restrictions_program: Program<'info, TransferRestrictions>,
    /// CHECK: extra account for the authority associated account
    pub authority_account: AccountInfo<'info>,
    /// CHECK: extra account for the authority
    pub security_associated_account_from: UncheckedAccount<'info>,
    /// CHECK: extra account for the recipient
    pub security_associated_account_to: UncheckedAccount<'info>,
    /// CHECK: extra account for the transfer rule
    pub transfer_rule: UncheckedAccount<'info>,
}

pub fn transfer_timelock<'info>(
    ctx: Context<'_, '_, '_, 'info, TransferTimelock<'info>>,
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
    if mint_address != ctx.accounts.to.mint || mint_address != ctx.accounts.mint_address.key() {
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

    let to = &ctx.accounts.to;
    if ctx.accounts.authority.key() != to.owner {
        if ctx.remaining_accounts.len() == 0 || ctx.remaining_accounts[0].key()
            != TokenLockDataWrapper::transfer_restriction_data(&tokenlock_account_data)
        {
            return Err(TokenlockErrors::InvalidTransferRestrictionData.into());
        }
        let cpi_accounts = EnforceTransferRestrictions {
            source_account: ctx.accounts.authority_account.clone(),
            mint: ctx.accounts.mint_address.to_account_info(),
            destination_account: to.to_account_info(),
            transfer_restriction_data: ctx.remaining_accounts[0].clone(),
            security_associated_account_from: ctx
                .accounts
                .security_associated_account_from
                .to_account_info(),
            security_associated_account_to: ctx
                .accounts
                .security_associated_account_to
                .to_account_info(),
            transfer_rule: ctx.accounts.transfer_rule.to_account_info(),
        };
        transfer_restrictions::cpi::enforce_transfer_restrictions(CpiContext::new(
            ctx.accounts.transfer_restrictions_program.to_account_info(),
            cpi_accounts,
        ))?;
    }

    transfer_spl_from_escrow(
        &ctx.accounts.token_program,
        &ctx.accounts.escrow_account.to_account_info(),
        &to.to_account_info(),
        &ctx.accounts.pda_account,
        value,
        &ctx.accounts.mint_address.to_account_info(),
        tokenlock_account.key,
        &ctx.remaining_accounts,
        ctx.accounts.mint_address.decimals,
        TokenLockDataWrapper::bump_seed(&tokenlock_account_data),
    )?;
    timelock.tokens_transferred = total_transfered_new;

    Ok(())
}
