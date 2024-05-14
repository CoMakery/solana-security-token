use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
  WalletRole,
  WALLET_ROLE_PREFIX,
};


#[derive(Accounts)]
pub struct UpdateWalletRole<'info> {
  #[account(mut,
    seeds = [
      WALLET_ROLE_PREFIX,
      &security_token.key().to_bytes(),
      &user_wallet.key().to_bytes(),
    ],
    bump,
  )]
  pub wallet_role: Account<'info, WalletRole>,
  #[account(
    seeds = [
      WALLET_ROLE_PREFIX,
      &security_token.key().to_bytes(),
      &payer.key().to_bytes(),
    ],
    bump,
  )]
  pub authority_wallet_role: Account<'info, WalletRole>,
  pub security_token: Box<InterfaceAccount<'info, Mint>>,
  /// CHECK: Wallet address which role to be updated
  pub user_wallet: AccountInfo<'info>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}
