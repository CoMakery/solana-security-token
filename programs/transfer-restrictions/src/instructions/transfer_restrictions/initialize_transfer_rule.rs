use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, InitializeTransferRule};

pub fn initialize_transfer_rule(
    ctx: Context<InitializeTransferRule>,
    locked_until: u64,
) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::TransferAdmin)
    {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }
    let transfer_rule = &mut ctx.accounts.transfer_rule;
    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;

    transfer_rule.transfer_restriction_data = transfer_restriction_data.key();
    transfer_rule.transfer_group_id_from = ctx.accounts.transfer_restriction_group_from.id;
    transfer_rule.transfer_group_id_to = ctx.accounts.transfer_restriction_group_to.id;
    transfer_rule.locked_until = locked_until;

    Ok(())
}
