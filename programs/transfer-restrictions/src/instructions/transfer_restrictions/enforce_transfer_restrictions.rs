use anchor_lang::prelude::*;

use crate::{
    errors::TransferRestrictionsError, validate_min_wallet_balance, EnforceTransferRestrictions,
};

pub fn enforce_transfer_restrictions(ctx: Context<EnforceTransferRestrictions>) -> Result<()> {
    let transfer_restriction_data = &ctx.accounts.transfer_restriction_data;
    if transfer_restriction_data.paused {
        return Err(TransferRestrictionsError::AllTransfersPaused.into());
    }

    // transfer restriction for lockup escrow account is validated inside tokenlock program
    if transfer_restriction_data.lockup_escrow_account
        == Some(ctx.accounts.destination_account.key())
        || transfer_restriction_data.lockup_escrow_account
            == Some(ctx.accounts.source_account.key())
    {
        return Ok(());
    }

    let transfer_rule = &ctx.accounts.transfer_rule;

    if transfer_rule.locked_until > Clock::get()?.unix_timestamp as u64 {
        return Err(TransferRestrictionsError::TransferRuleLocked.into());
    }

    validate_min_wallet_balance(
        transfer_restriction_data.min_wallet_balance,
        ctx.accounts.source_account.amount,
    )?;

    Ok(())
}
