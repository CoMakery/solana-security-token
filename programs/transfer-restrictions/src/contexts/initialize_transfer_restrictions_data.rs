use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, Token2022};
use std::mem;

use crate::{contexts::common::DISCRIMINATOR_LEN, AccessControl};

pub const TRANSFER_RESTRICTION_DATA_PREFIX: &str = "transfer_restriction_data";


#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct TransferRestrictionData {
  pub security_token_mint: Pubkey,
  pub access_control_account: Pubkey,
  pub current_holders_count: u64,
  pub max_holders: u64,
}

#[derive(Accounts)]
pub struct InitializeTransferRestrictionData<'info> {
  #[account(init, payer = payer, space = DISCRIMINATOR_LEN + TransferRestrictionData::INIT_SPACE,
    seeds = [
      TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
      &mint.key().to_bytes(),
    ],
    bump,
  )]
  pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
  #[account(
      mint::token_program = token_program,
  )]
  pub mint: Box<InterfaceAccount<'info, Mint>>,
  pub access_control_account: Account<'info, AccessControl>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, Token2022>,
}