use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, SetAllowTransferRule};

pub fn set_allow_transfer_rule(
    ctx: Context<SetAllowTransferRule>,
    locked_until: u64,
) -> Result<()> {
    if !ctx.accounts.authority_wallet_role.has_role(Roles::TransferAdmin) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let transfer_rule = &mut ctx.accounts.transfer_rule;
    transfer_rule.locked_until = locked_until;

    Ok(())
}
