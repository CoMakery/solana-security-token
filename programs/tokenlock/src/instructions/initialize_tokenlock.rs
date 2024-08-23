use access_control::{program::AccessControl as AccessControlProgram, AccessControl, WalletRole};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};
use transfer_restrictions::{
    program::TransferRestrictions as TransferRestrictionsProgram, TransferRestrictionData,
};

use crate::{error::TokenlockErrors, TOKENLOCK_PDA_SEED};
use tokenlock_accounts::states::TokenLockData;

#[derive(Accounts)]
pub struct InitializeTokenLock<'info> {
    #[account(zero)]
    pub tokenlock_account: Account<'info, TokenLockData>,

    #[account(mut,
        constraint = *escrow_account.to_account_info().owner == *token_program.key,
        constraint = escrow_account.mint == mint_address.key(),
    )]
    pub escrow_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program,
        constraint = mint_address.key() == access_control.mint,
    )]
    pub mint_address: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        constraint = transfer_restrictions_data.security_token_mint == mint_address.key(),
        constraint = transfer_restrictions_data.access_control_account == access_control.key(),
        owner = TransferRestrictionsProgram::id(),
    )]
    pub transfer_restrictions_data: Account<'info, TransferRestrictionData>,

    #[account(
        constraint = authority_wallet_role.owner == authority.key(),
        constraint = authority_wallet_role.has_role(access_control::Roles::ContractAdmin) @ TokenlockErrors::Unauthorized,
        constraint = authority_wallet_role.access_control == access_control.key(),
        owner = AccessControlProgram::id(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(owner = AccessControlProgram::id())]
    pub access_control: Account<'info, AccessControl>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
}

impl<'info> InitializeTokenLock<'info> {
    pub fn new(
        tokenlock_account: Account<'info, TokenLockData>,
        escrow_account: Box<InterfaceAccount<'info, TokenAccount>>,
        mint_address: Box<InterfaceAccount<'info, Mint>>,
        token_program: Program<'info, Token2022>,
        authority_wallet_role: Account<'info, WalletRole>,
        authority: Signer<'info>,
        access_control: Account<'info, AccessControl>,
        transfer_restrictions_data: Account<'info, TransferRestrictionData>,
    ) -> InitializeTokenLock<'info> {
        Self {
            tokenlock_account,
            escrow_account,
            mint_address,
            token_program,
            authority_wallet_role,
            authority,
            access_control,
            transfer_restrictions_data,
        }
    }
}

pub fn initialize_tokenlock(
    ctx: Context<InitializeTokenLock>,
    max_release_delay: u64,
    min_timelock_amount: u64,
) -> Result<()> {
    let tokenlock_account = &mut ctx.accounts.tokenlock_account;

    require!(
        max_release_delay >= 1,
        TokenlockErrors::MaxReleaseDelayLessThanOne
    );

    require!(
        min_timelock_amount >= 1,
        TokenlockErrors::MinTimelockAmountLessThanOne
    );

    let mint_address = ctx.accounts.mint_address.key();
    let (pda, bump_seed) = Pubkey::find_program_address(
        &[
            TOKENLOCK_PDA_SEED,
            mint_address.as_ref(),
            tokenlock_account.to_account_info().key.as_ref(),
        ],
        ctx.program_id,
    );

    let escrow_account = &ctx.accounts.escrow_account;
    if escrow_account.owner != pda
        || (escrow_account.delegate.is_some() && escrow_account.delegated_amount != 0)
    {
        return Err(TokenlockErrors::IncorrectEscrowAccount.into());
    }

    //init tokenlock
    tokenlock_account.escrow_account = *escrow_account.to_account_info().key;
    tokenlock_account.mint_address = mint_address;

    tokenlock_account.max_release_delay = max_release_delay;
    tokenlock_account.min_timelock_amount = min_timelock_amount;
    tokenlock_account.release_schedules = Vec::new();
    tokenlock_account.bump_seed = bump_seed;
    tokenlock_account.access_control = ctx.accounts.access_control.key();
    tokenlock_account.transfer_restrictions_data = ctx.accounts.transfer_restrictions_data.key();

    Ok(())
}
