use anchor_lang::prelude::*;
use crate::{
  contexts::common::DISCRIMINATOR_LEN,
  AccessControl,
  TransferRestrictionData,
  TransferRestrictionGroup,
  TRANSFER_RESTRICTION_DATA_PREFIX,
};

pub const TRANSFER_RULE_PREFIX: &str = "tr"; // transfer_rule


#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct TransferRule {
  pub transfer_restriction_data: Pubkey,
  pub transfer_group_id_from: u64,
  pub transfer_group_id_to: u64,
  pub locked_until: u64,
}

#[derive(Accounts)]
#[instruction(locked_until: u64)]
pub struct InitializeTransferRule<'info> {
  #[account(init, payer = payer, space = DISCRIMINATOR_LEN + TransferRule::INIT_SPACE,
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
