use anchor_lang::prelude::*;

use crate::InitializeTransferRestrictionData;

pub fn initialize_data(ctx: Context<InitializeTransferRestrictionData>, max_holders: u64) -> Result<()> {
  let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
  transfer_restriction_data.security_token_mint = *ctx.accounts.mint.to_account_info().key;
  transfer_restriction_data.access_control_account = *ctx.accounts.access_control_account.to_account_info().key;
  transfer_restriction_data.current_holders_count = 0;
  transfer_restriction_data.max_holders = max_holders;

  Ok(())
}