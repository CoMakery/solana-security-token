use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
  SecurityAssociatedAccount, TransferRestrictionData, TransferRestrictionGroup,
  SECURITY_ASSOCIATED_ACCOUNT_PREFIX, TRANSFER_RESTRICTION_DATA_PREFIX,
  TRANSFER_RESTRICTION_GROUP_PREFIX,
};

#[derive(Accounts)]
pub struct UpdateWalletGroup<'info> {
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
  #[account(
    constraint = transfer_restriction_group.transfer_restriction_data == transfer_restriction_data.key(),
    seeds = [
      TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(),
      &transfer_restriction_data.key().to_bytes(),
      &transfer_restriction_group.id.to_le_bytes()],
    bump,
  )]
  pub transfer_restriction_group: Account<'info, TransferRestrictionGroup>,
  /// CHECK: Wallet address which role to be updated
  pub user_wallet: AccountInfo<'info>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}
