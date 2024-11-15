use crate::{contexts::Pause, errors::TransferRestrictionsError};
use access_control::Roles;
use anchor_lang::prelude::*;

pub fn pause(ctx: Context<Pause>, paused: bool) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::TransferAdmin)
    {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }
    if paused == ctx.accounts.transfer_restriction_data.paused {
        return Err(TransferRestrictionsError::ValueUnchanged.into());
    }

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    transfer_restriction_data.paused = paused;

    Ok(())
}
