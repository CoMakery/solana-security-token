use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use std::mem;

use crate::{
  contexts::common::DISCRIMINATOR_LEN,
  TransferRestrictionData,
  TransferRestrictionGroup,
  TransferRestrictionHolder,
  TRANSFER_RESTRICTION_DATA_PREFIX,
};


pub const SECURITY_ASSOCIATED_ACCOUNT_PREFIX: &str = "security_associated_account";

#[account]
#[derive(Default)]
pub struct SecurityAssociatedAccount {
  pub group: Pubkey,
  pub holder: Pubkey,
}

impl SecurityAssociatedAccount {
  const ROLE_LEN: usize = mem::size_of::<u8>();
  const GROUP_LEN: usize = mem::size_of::<Pubkey>();
  const HOLDER_LEN: usize = mem::size_of::<Pubkey>();
  
  pub fn size() -> usize {
    DISCRIMINATOR_LEN
    + Self::ROLE_LEN
    + Self::GROUP_LEN
    + Self::HOLDER_LEN
  }
}

#[derive(Accounts)]
#[instruction()]
pub struct InitializeSecurityAssociatedAccount<'info> {
  #[account(init, payer = payer, space = SecurityAssociatedAccount::size(),
    seeds = [
      SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
      &security_token.key().to_bytes(),
      &user_wallet.key().to_bytes(),
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
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}
