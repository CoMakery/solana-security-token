use anchor_lang::prelude::*;
use crate::{
  contexts::UpdateWalletRole,
  errors::SolanaSecurityTokenError,
  Roles,
};

pub fn update_wallet_role(ctx: Context<UpdateWalletRole>, role: u8) -> Result<()> {
  if !ctx.accounts.authority_wallet_role.has_role(Roles::ContractAdmin) {
    return Err(SolanaSecurityTokenError::Unauthorized.into());
  }

  let security_associated_account = &mut ctx.accounts.wallet_role;
  security_associated_account.role = role;

  Ok(())
}
