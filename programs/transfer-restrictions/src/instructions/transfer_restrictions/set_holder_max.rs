use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, SetHolderMax};

pub fn set_holder_max(
    ctx: Context<SetHolderMax>,
    holder_max: u64,
) -> Result<()> {
    if !ctx.accounts.authority_wallet_role.has_role(Roles::TransferAdmin) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    transfer_restriction_data.max_holders = holder_max;

    Ok(())
}