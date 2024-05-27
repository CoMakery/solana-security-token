use crate::{contexts::InitializeWalletRole, errors::AccessControlError, Roles};
use anchor_lang::prelude::*;

pub fn initialize_wallet_role(ctx: Context<InitializeWalletRole>, role: u8) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::ContractAdmin)
    {
        return Err(AccessControlError::Unauthorized.into());
    }

    let wallet_role = &mut ctx.accounts.wallet_role;
    wallet_role.role = role;
    wallet_role.owner = ctx.accounts.user_wallet.key();
    wallet_role.access_control = ctx.accounts.access_control.key();

    Ok(())
}
