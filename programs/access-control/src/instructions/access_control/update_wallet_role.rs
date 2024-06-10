use crate::{contexts::UpdateWalletRole, errors::AccessControlError, Roles};
use anchor_lang::prelude::*;

pub fn update_wallet_role(ctx: Context<UpdateWalletRole>, role: u8) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::ContractAdmin)
    {
        return Err(AccessControlError::Unauthorized.into());
    }
    if role > Roles::All as u8 {
        return Err(AccessControlError::InvalidRole.into());
    }

    let wallet_role = &mut ctx.accounts.wallet_role;
    wallet_role.role = role;

    Ok(())
}
