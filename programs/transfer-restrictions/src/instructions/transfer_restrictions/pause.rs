use crate::{contexts::Pause, errors::TransferRestrictionsError};
use access_control::Roles;
use anchor_lang::prelude::*;

pub fn pause(ctx: Context<Pause>, paused: bool) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_any_role(Roles::ContractAdmin as u8 | Roles::TransferAdmin as u8)
    {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    transfer_restriction_data.paused = paused;

    Ok(())
}
