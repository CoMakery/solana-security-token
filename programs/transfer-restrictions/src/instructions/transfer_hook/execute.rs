use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, ExecuteTransferHook};

pub fn handler(ctx: Context<ExecuteTransferHook>, _amount: u64) -> Result<()> {
    // TODO: add transfer restrictions checks here
    let transfer_rule = &ctx.accounts.transfer_rule;

    if transfer_rule.locked_until > Clock::get()?.unix_timestamp as u64 {
        return Err(TransferRestrictionsError::TransferRuleLocked.into());
    }

    Ok(())
}
