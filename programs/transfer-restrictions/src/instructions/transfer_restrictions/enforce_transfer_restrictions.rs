use anchor_lang::prelude::*;

use crate::{
    errors::TransferRestrictionsError, EnforceTransferRestrictions,
};

pub fn enforce_transfer_restrictions(ctx: Context<EnforceTransferRestrictions>) -> Result<()> {
    let transfer_restriction_data = &ctx.accounts.transfer_restriction_data;
    if transfer_restriction_data.paused {
        return Err(TransferRestrictionsError::AllTransfersPaused.into());
    }

    let transfer_rule = &ctx.accounts.transfer_rule;
    if transfer_rule.locked_until == 0 {
        return Err(TransferRestrictionsError::TransferGroupNotApproved.into());
    }
    if transfer_rule.locked_until > Clock::get()?.unix_timestamp as u64 {
        return Err(TransferRestrictionsError::TransferRuleNotAllowedUntilLater.into());
    }

    Ok(())
}
