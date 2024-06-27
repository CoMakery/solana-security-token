use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, SetHolderGroupMax};

pub fn set_holder_group_max(
    ctx: Context<SetHolderGroupMax>,
    holder_max: u64,
) -> Result<()> {
    if !ctx.accounts.authority_wallet_role.has_role(Roles::TransferAdmin) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let group = &mut ctx.accounts.group;
    group.max_holders = holder_max;

    Ok(())
}
