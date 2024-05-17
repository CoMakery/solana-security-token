use anchor_lang::prelude::*;

use crate::InitializeSecurityAssociatedAccount;

pub fn initialize_security_associated_account(ctx: Context<InitializeSecurityAssociatedAccount>) -> Result<()> {
  let security_associated_account = &mut ctx.accounts.security_associated_account;

  security_associated_account.group = ctx.accounts.group.id;
  security_associated_account.holder = *ctx.accounts.holder.to_account_info().key;

  Ok(())
}
