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
  if role > Roles::All as u8 {
    return Err(SolanaSecurityTokenError::InvalidRole.into());
  }

  let wallet_role = &mut ctx.accounts.wallet_role;
  wallet_role.role = role;

  Ok(())
}
