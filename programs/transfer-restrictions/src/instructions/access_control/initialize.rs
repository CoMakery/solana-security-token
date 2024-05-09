use anchor_lang::prelude::*;
use crate::contexts::InitializeAccessControl;

pub fn initialize(ctx: Context<InitializeAccessControl>) -> Result<()> {
  let access_control = &mut ctx.accounts.access_control;
  access_control.mint = *ctx.accounts.mint.to_account_info().key;

  Ok(())
}