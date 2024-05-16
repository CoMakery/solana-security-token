use anchor_lang::prelude::*;
use crate::{contexts::common::DISCRIMINATOR_LEN, AccessControl, TransferRestrictionData, TRANSFER_RESTRICTION_DATA_PREFIX};

// Short name is required for transfer hook meta account list specification (32 bytes limit)
pub const TRANSFER_RESTRICTION_GROUP_PREFIX: &str = "tr_group";


#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct TransferRestrictionGroup {
  pub id: u64,
  pub current_holders_count: u64,
  pub max_holders: u64,
  pub transfer_restriction_data: Pubkey,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct InitializeTransferRestrictionGroup<'info> {
  #[account(init, payer = payer, space = DISCRIMINATOR_LEN + TransferRestrictionGroup::INIT_SPACE,
    seeds = [
      TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes(),
      &transfer_restriction_data.key().to_bytes(),
      &id.to_le_bytes()
    ],
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
