use anchor_lang::prelude::*;
use std::mem;
use crate::{
  contexts::common::DISCRIMINATOR_LEN,
  AccessControl,
  TransferRestrictionData,
  TransferRestrictionGroup,
  TRANSFER_RESTRICTION_DATA_PREFIX,
};

pub const TRANSFER_RULE_PREFIX: &str = "transfer_rule";


#[account]
#[derive(Default)]
pub struct TransferRule {
  pub transfer_restriction_data: Pubkey,
  pub transfer_group_id_from: u64,
  pub transfer_group_id_to: u64,
  pub lock_until: u64,
}

impl TransferRule {
  const TRANSFER_RESTRICTION_DATA_LEN: usize = mem::size_of::<Pubkey>();
  const TRANSFER_GROUP_ID_FROM_LEN: usize = mem::size_of::<u64>();
  const TRANSFER_GROUP_ID_TO_LEN: usize = mem::size_of::<u64>();
  const LOCK_UNTIL_LEN: usize = mem::size_of::<u64>();
  
  pub fn size() -> usize {
    DISCRIMINATOR_LEN
    + Self::TRANSFER_RESTRICTION_DATA_LEN
    + Self::TRANSFER_GROUP_ID_FROM_LEN
    + Self::TRANSFER_GROUP_ID_TO_LEN
    + Self::LOCK_UNTIL_LEN
  }
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct InitializeTransferRule<'info> {
  #[account(init, payer = payer, space = TransferRule::size(),
    seeds = [
      TRANSFER_RULE_PREFIX.as_bytes(),
      &transfer_restriction_group_from.key().to_bytes(),
      &transfer_restriction_group_to.key().to_bytes(),
    ],
    bump,
  )]
  pub transfer_rule: Account<'info, TransferRule>,

  #[account(
    seeds = [TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(), &access_control_account.mint.key().to_bytes()],
    bump,
  )]
  pub transfer_restriction_data: Account<'info, TransferRestrictionData>,
  #[account(
    constraint = transfer_restriction_group_from.transfer_restriction_data == transfer_restriction_data.key(),
  )]
  pub transfer_restriction_group_from: Account<'info, TransferRestrictionGroup>,
  #[account(
    constraint = transfer_restriction_group_to.transfer_restriction_data == transfer_restriction_data.key(),
  )]
  pub transfer_restriction_group_to: Account<'info, TransferRestrictionGroup>,
  pub access_control_account: Account<'info, AccessControl>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}
