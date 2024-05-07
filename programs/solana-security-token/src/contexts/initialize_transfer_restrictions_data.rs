use anchor_lang::prelude::*;
use std::mem;

use crate::{contexts::common::DISCRIMINATOR_LEN, AccessControl};

pub const TRANSFER_RESTRICTION_DATA_PREFIX: &str = "transfer_restriction_data";


#[account]
#[derive(Default)]
pub struct TransferRestrictionData {
  pub security_token_mint: Pubkey,
  pub access_control_account: Pubkey,
  pub current_holders_count: u64,
  pub max_holders: u64,
}

impl TransferRestrictionData {
  const SECURITY_TOKEN_MINT_LEN: usize = mem::size_of::<Pubkey>();
  const CURRENT_HOLDERS_COUNT_LEN: usize = mem::size_of::<u64>();
  const MAX_HOLDERS_LEN: usize = mem::size_of::<u64>();

  pub fn size() -> usize {
    DISCRIMINATOR_LEN
    + Self::SECURITY_TOKEN_MINT_LEN
    + Self::CURRENT_HOLDERS_COUNT_LEN
    + Self::MAX_HOLDERS_LEN
  }
}

#[derive(Accounts)]
pub struct InitializeTransferRestrictionData<'info> {
  #[account(init,payer = payer, space = TransferRestrictionData::size(),
    seeds = [TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(), &mint.key.to_bytes()],
    bump,
  )]
  pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
  // https://github.com/coral-xyz/anchor/blob/9761ea60088a73a660c2f02d1151782174d0913e/tests/spl/token-extensions/programs/token-extensions/src/instructions.rs#L57C19-L57C35
  // pub mint: Box<InterfaceAccount<'info, Mint>>,
  // TODO: validate that the mint is a valid mint
  /// CHECK: Mint address to be controlled by the access control
  pub mint: AccountInfo<'info>,
  pub access_control_account: Account<'info, AccessControl>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}