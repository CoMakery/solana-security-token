use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::*, DeactivateHolder};

pub fn deactivate_holder(ctx: Context<DeactivateHolder>) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_any_role(Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8)
    {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let holder = &mut ctx.accounts.holder;
    holder.active = false;

    Ok(())
}
