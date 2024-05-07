use anchor_lang::prelude::*;
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
  // https://github.com/coral-xyz/anchor/blob/9761ea60088a73a660c2f02d1151782174d0913e/tests/spl/token-extensions/programs/token-extensions/src/instructions.rs#L57C19-L57C35
  // pub mint: Box<InterfaceAccount<'info, Mint>>,
  // TODO: validate that the mint is a valid mint
  /// CHECK: Mint address to be controlled by the access control
  pub mint: AccountInfo<'info>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}