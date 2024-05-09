use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, Token2022};
use std::mem;
use num_enum::IntoPrimitive;

use crate::contexts::common::DISCRIMINATOR_LEN;


#[repr(u8)]
#[derive(IntoPrimitive, AnchorDeserialize, AnchorSerialize, Clone, InitSpace, Copy, Debug)]
pub enum Roles {
  ContractAdmin = 1,
  ReserveAdmin = 2,
  WalletAdmin = 4,
  TransferAdmin = 8,
}

#[account]
#[derive(Default)]
pub struct AccessControl {
  pub mint: Pubkey
}

impl AccessControl {
  const MINT_LEN: usize = mem::size_of::<Pubkey>();

  pub fn size() -> usize {
    DISCRIMINATOR_LEN
    + Self::MINT_LEN
  }
}

#[derive(Accounts)]
pub struct InitializeAccessControl<'info> {
  #[account(init, payer = payer, space = AccessControl::size(),
    seeds = [b"access-control".as_ref(), mint.to_account_info().key.as_ref()],
    bump,
  )]
  pub access_control: Account<'info, AccessControl>,
  #[account(
    mint::token_program = token_program,
  )]
  pub mint: Box<InterfaceAccount<'info, Mint>>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, Token2022>,
}