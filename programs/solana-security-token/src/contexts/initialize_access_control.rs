use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, Token2022};
use std::mem;

use crate::contexts::common::DISCRIMINATOR_LEN;


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
  #[account(init, payer = payer, space = AccessControl::size())]
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