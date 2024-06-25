use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, InitializeHolderGroup};

pub fn initialize_holder_group(ctx: Context<InitializeHolderGroup>) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::TransferAdmin)
    {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let holder_group = &mut ctx.accounts.holder_group;

    holder_group.group = ctx.accounts.group.id;
    holder_group.holder = ctx.accounts.holder.key();
    holder_group.current_wallets_count = 0;

    Ok(())
}
