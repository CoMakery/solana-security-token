use anchor_lang::prelude::*;
use crate::contexts::UpdateWalletRole;

pub fn update_wallet_role(ctx: Context<UpdateWalletRole>, role: u8) -> Result<()> {
  // TODO: add check that signer has rights to update wallet role
  let security_associated_account = &mut ctx.accounts.security_associated_account;
  security_associated_account.role = role;

  Ok(())
}