use anchor_lang::prelude::*;
use crate::{
  contexts::InitializeWalletRole,
  errors::SolanaSecurityTokenError,
  Roles,
};

pub fn initialize_wallet_role(ctx: Context<InitializeWalletRole>, role: u8) -> Result<()> {
  if !ctx.accounts.authority_wallet_role.has_role(Roles::ContractAdmin) {
    return Err(SolanaSecurityTokenError::Unauthorized.into());
  }

  let wallet_role = &mut ctx.accounts.wallet_role;
  wallet_role.role = role;

  Ok(())
}