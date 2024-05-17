use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::{
  contexts::common::DISCRIMINATOR_LEN,
  TransferRestrictionData,
  TransferRestrictionGroup,
  TransferRestrictionHolder,
  TRANSFER_RESTRICTION_DATA_PREFIX,
};


pub const SECURITY_ASSOCIATED_ACCOUNT_PREFIX: &str = "saa"; // security associated account

#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct SecurityAssociatedAccount {
  pub group: u64,
  pub holder: Pubkey,
}

#[derive(Accounts)]
#[instruction()]
pub struct InitializeSecurityAssociatedAccount<'info> {
  #[account(init, payer = payer, space = DISCRIMINATOR_LEN + SecurityAssociatedAccount::INIT_SPACE,
    seeds = [
      SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
      &associated_token_account.key().to_bytes(),
    ],
    bump,
  )]
  pub security_associated_account: Account<'info, SecurityAssociatedAccount>,
  #[account(
    constraint = group.transfer_restriction_data == transfer_restriction_data.key(),
  )]
  pub group: Account<'info, TransferRestrictionGroup>,
  #[account(
    constraint = holder.transfer_restriction_data == transfer_restriction_data.key(),
  )]
  pub holder: Account<'info, TransferRestrictionHolder>,
  #[account(
      constraint = security_token.key() == transfer_restriction_data.security_token_mint,
      token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
    )]
  pub security_token: Box<InterfaceAccount<'info, Mint>>,
  #[account(
    seeds = [
      TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
      &security_token.key().to_bytes(),
    ],
    bump
  )]
  pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
  /// CHECK: Wallet address to be controlled by the access control
  pub user_wallet: AccountInfo<'info>,
  #[account(
    associated_token::token_program = anchor_spl::token_interface::spl_token_2022::id(),
    associated_token::mint = security_token,
    associated_token::authority = user_wallet,
  )]
  pub associated_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}