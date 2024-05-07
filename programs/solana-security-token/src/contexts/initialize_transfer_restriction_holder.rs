use anchor_lang::prelude::*;
use std::mem;
use crate::{contexts::common::DISCRIMINATOR_LEN, AccessControl, TransferRestrictionData, TRANSFER_RESTRICTION_DATA_PREFIX};

pub const TRANSFER_RESTRICTION_HOLDER_PREFIX: &str = "transfer_restriction_holder";


#[account]
#[derive(Default)]
pub struct TransferRestrictionHolder {
  pub transfer_restriction_data: Pubkey,
  pub current_wallets_count: u64,
  pub id: u64,
  pub active: bool,
}

impl TransferRestrictionHolder {
  const TRANSFER_RESTRICTION_DATA_LEN: usize = mem::size_of::<Pubkey>();
  const CURRENT_WALLETS_COUNT_LEN: usize = mem::size_of::<u64>();
  const ID_LEN: usize = mem::size_of::<u64>();
  const ACTIVE_LEN: usize = mem::size_of::<bool>();
  
  pub fn size() -> usize {
    DISCRIMINATOR_LEN
    + Self::TRANSFER_RESTRICTION_DATA_LEN
    + Self::CURRENT_WALLETS_COUNT_LEN
    + Self::ID_LEN
    + Self::ACTIVE_LEN
  }
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct InitializeTransferRestrictionHolder<'info> {
  #[account(init, payer = payer, space = TransferRestrictionHolder::size(),
    seeds = [TRANSFER_RESTRICTION_HOLDER_PREFIX.as_bytes(), &transfer_restriction_data.key().to_bytes(), &id.to_le_bytes()],
    bump,
  )]
  pub transfer_restriction_holder: Account<'info, TransferRestrictionHolder>,

  #[account(mut,
    seeds = [TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(), &access_control_account.mint.key().to_bytes()],
    bump,
  )]
  pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
  pub access_control_account: Account<'info, AccessControl>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}
