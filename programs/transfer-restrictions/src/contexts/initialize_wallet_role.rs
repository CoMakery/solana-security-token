use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use std::mem;

use crate::{
  contexts::common::DISCRIMINATOR_LEN,
  Roles,
};


pub const WALLET_ROLE_PREFIX: &str = "wallet_role";

#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct WalletRole {
  pub role: u8,
}

impl WalletRole {
  pub fn has_role(&self, role: Roles) -> bool {
    let role = role as u8;
    self.role & role == role
  }
}

#[derive(Accounts)]
#[instruction()]
pub struct InitializeWalletRole<'info> {
  #[account(init, payer = payer, space = DISCRIMINATOR_LEN + WalletRole::INIT_SPACE,
    seeds = [
      WALLET_ROLE_PREFIX.as_bytes(),
      &security_token.key().to_bytes(),
      &user_wallet.key().to_bytes(),
    ],
    bump,
  )]
  pub wallet_role: Account<'info, WalletRole>,
  #[account(
    seeds = [
      WALLET_ROLE_PREFIX.as_bytes(),
      &security_token.key().to_bytes(),
      &payer.key().to_bytes(),
    ],
    bump,
  )]
  pub authority_wallet_role: Account<'info, WalletRole>,
  pub security_token: Box<InterfaceAccount<'info, Mint>>,

  /// CHECK: Wallet address to be controlled by the access control
  pub user_wallet: AccountInfo<'info>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}
