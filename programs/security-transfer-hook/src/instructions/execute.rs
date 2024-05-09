use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};
use transfer_restrictions::{
  program::TransferRestrictions,
  SecurityAssociatedAccount,
  TransferRule,
  TransferRestrictionData,
};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct ExecuteTransferHook<'info> {
    #[account(
        associated_token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
        associated_token::authority = owner_delegate,
        associated_token::mint = asset_mint,
    )]
    pub source_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
    )]
    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        token::mint = asset_mint,
        token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
    )]
    pub destination_account: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: can be any account
    pub owner_delegate: UncheckedAccount<'info>,
    /// CHECK: meta list account
    #[account(
        seeds = [b"extra-account-metas", asset_mint.key().as_ref()],
        bump,
    )]
    pub extra_metas_account: UncheckedAccount<'info>,
    pub transfer_restriction_data: Box<Account<'info, TransferRestrictionData>>,
    pub security_token_program: Program<'info, TransferRestrictions>,
    pub security_associated_account_from: Box<Account<'info, SecurityAssociatedAccount>>,
    pub security_associated_account_to: Box<Account<'info, SecurityAssociatedAccount>>,
    pub transfer_rule: Box<Account<'info, TransferRule>>,
}

pub fn handler(ctx: Context<ExecuteTransferHook>, amount: u64) -> Result<()> {
    Ok(())
}
