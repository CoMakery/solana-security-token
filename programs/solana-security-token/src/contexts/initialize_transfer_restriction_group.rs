use anchor_lang::prelude::*;
use std::mem;
use crate::{contexts::common::DISCRIMINATOR_LEN, AccessControl, TransferRestrictionData, TRANSFER_RESTRICTION_DATA_PREFIX};

pub const TRANSFER_RESTRICTION_GROUP_PREFIX: &str = "transfer_restriction_group";


#[account]
#[derive(Default)]
pub struct TransferRestrictionGroup {
  pub transfer_restriction_data: Pubkey,
  pub current_holders_count: u64,
  pub max_holders: u64,
  pub id: u64,
}

impl TransferRestrictionGroup {
  const TRANSFER_RESTRICTION_DATA_LEN: usize = mem::size_of::<Pubkey>();
  const CURRENT_HOLDERS_COUNT_LEN: usize = mem::size_of::<u64>();
  const MAX_HOLDERS_LEN: usize = mem::size_of::<u64>();
  const ID_LEN: usize = mem::size_of::<u64>();
  
  pub fn size() -> usize {
    DISCRIMINATOR_LEN
    + Self::TRANSFER_RESTRICTION_DATA_LEN
    + Self::CURRENT_HOLDERS_COUNT_LEN
    + Self::MAX_HOLDERS_LEN
    + Self::ID_LEN
  }
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct InitializeTransferRestrictionGroup<'info> {
  #[account(init, payer = payer, space = TransferRestrictionGroup::size(),
    seeds = [TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(), &transfer_restriction_data.key().to_bytes(), &id.to_le_bytes()],
    bump,
  )]
  pub transfer_restriction_group: Account<'info, TransferRestrictionGroup>,

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
