use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
  SecurityAssociatedAccount,
  TransferRestrictionData,
  SECURITY_ASSOCIATED_ACCOUNT_PREFIX,
  TRANSFER_RESTRICTION_DATA_PREFIX,
};


#[derive(Accounts)]
pub struct UpdateWalletRole<'info> {
  #[account(mut,
    seeds = [
      SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
      &security_token.key().to_bytes(),
      &user_wallet.key().to_bytes(),
    ],
    bump,
  )]
  pub security_associated_account: Account<'info, SecurityAssociatedAccount>,
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
  /// CHECK: Wallet address which role to be updated
  pub user_wallet: AccountInfo<'info>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}
