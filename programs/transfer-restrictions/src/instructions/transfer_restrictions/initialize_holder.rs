use anchor_lang::prelude::*;

use crate::InitializeTransferRestrictionHolder;
use crate::errors::*;

pub fn initialize_holder(ctx: Context<InitializeTransferRestrictionHolder>, id: u64) -> Result<()> {
  let transfer_restriction_holder = &mut ctx.accounts.transfer_restriction_holder;
  let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
  if transfer_restriction_data.current_holders_count == transfer_restriction_data.max_holders {
    return Err(TransferRestrictionsError::MaxHoldersReached.into());
  }

  transfer_restriction_holder.transfer_restriction_data = transfer_restriction_data.key();
  transfer_restriction_holder.id = id;
  transfer_restriction_holder.current_wallets_count = 0;
  transfer_restriction_data.current_holders_count = transfer_restriction_data.current_holders_count.checked_add(1).unwrap();
  transfer_restriction_data.holder_ids = transfer_restriction_data.holder_ids.checked_add(1).unwrap();

  Ok(())
}