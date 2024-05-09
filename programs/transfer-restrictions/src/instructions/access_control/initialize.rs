use anchor_lang::prelude::*;
use crate::{
  contexts::InitializeAccessControl,
  Roles,
};


pub fn initialize(ctx: Context<InitializeAccessControl>) -> Result<()> {
  let access_control = &mut ctx.accounts.access_control;
  access_control.mint = *ctx.accounts.mint.to_account_info().key;

  let wallet_role = &mut ctx.accounts.authority_wallet_role;
  wallet_role.role = Roles::All as u8;

  Ok(())
}
