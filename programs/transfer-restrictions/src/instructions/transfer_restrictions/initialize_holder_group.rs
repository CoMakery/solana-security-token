use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, InitializeHolderGroup};

pub fn initialize_holder_group(ctx: Context<InitializeHolderGroup>) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_any_role(Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8)
    {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let holder_group = &mut ctx.accounts.holder_group;

    holder_group.group = ctx.accounts.group.id;
    holder_group.holder = ctx.accounts.holder.key();
    holder_group.current_wallets_count = 0;

    let holder = &mut ctx.accounts.holder;
    holder.current_holder_group_count = holder.current_holder_group_count.checked_add(1).unwrap();

    Ok(())
}
