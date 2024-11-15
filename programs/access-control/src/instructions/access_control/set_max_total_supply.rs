use anchor_lang::prelude::*;

use crate::{errors::AccessControlError, Roles, SetMaxTotalSupply};

pub fn set_max_total_supply(ctx: Context<SetMaxTotalSupply>, max_total_supply: u64) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::ReserveAdmin)
    {
        return Err(AccessControlError::Unauthorized.into());
    }
    if max_total_supply <= ctx.accounts.access_control_account.max_total_supply {
        return Err(AccessControlError::NewMaxTotalSupplyMustExceedCurrentTotalSupply.into());
    }

    let access_control_account = &mut ctx.accounts.access_control_account;
    access_control_account.max_total_supply = max_total_supply;

    Ok(())
}
