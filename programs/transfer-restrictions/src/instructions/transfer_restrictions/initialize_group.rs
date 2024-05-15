use anchor_lang::prelude::*;

use crate::InitializeTransferRestrictionGroup;

pub fn initialize_group(ctx: Context<InitializeTransferRestrictionGroup>, id: u64) -> Result<()> {
  // TODO: Add check onlyWalletsAdminOrTransferAdmin
  let transfer_restriction_group = &mut ctx.accounts.transfer_restriction_group;
  let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;

  transfer_restriction_group.transfer_restriction_data = transfer_restriction_data.key();
  transfer_restriction_group.id = id;
  transfer_restriction_group.current_holders_count = 0;
  transfer_restriction_group.max_holders = transfer_restriction_data.max_holders;

  Ok(())
}