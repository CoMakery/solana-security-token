use access_control::common::DISCRIMINATOR_LEN;
use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::spl_token_2022::extension::permanent_delegate::PermanentDelegate,
    token_interface::get_mint_extension_data,
};

use crate::{
    errors::TransferRestrictionsError, verify_pda,
    ExecuteTransferHook, SecurityAssociatedAccount, TransferRestrictionData, TransferRule,
    SECURITY_ASSOCIATED_ACCOUNT_PREFIX, TRANSFER_RESTRICTION_DATA_PREFIX, TRANSFER_RULE_PREFIX,
};

pub fn handler(ctx: Context<ExecuteTransferHook>, _amount: u64) -> Result<()> {
    let mint_data: &AccountInfo = &ctx.accounts.mint.to_account_info();
    let permanent_delegate_extension = get_mint_extension_data::<PermanentDelegate>(mint_data)?;
    // if permanent delegate is execute transfer hook owner delegate
    // we don't need to check transfer restrictions because it's force transfer between
    if permanent_delegate_extension.delegate
        == Some(ctx.accounts.owner_delegate.key()).try_into().unwrap()
    {
        return Ok(());
    }

    verify_pda(
        ctx.accounts.transfer_restriction_data.key,
        &[
            TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes(),
            &mint_data.key().to_bytes(),
        ],
        &ctx.program_id,
    )?;
    let transfer_restriction_data = TransferRestrictionData::deserialize(
        &mut &ctx.accounts.transfer_restriction_data.data.borrow()[DISCRIMINATOR_LEN..],
    )?;
    // transfer restriction for lockup escrow account is validated inside tokenlock program
    if transfer_restriction_data.lockup_escrow_account == Some(ctx.accounts.source_account.key()) {
        return Ok(());
    }
    if transfer_restriction_data.paused {
        return Err(TransferRestrictionsError::AllTransfersPaused.into());
    }

    verify_pda(
        ctx.accounts.security_associated_account_from.key,
        &[
            SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
            &ctx.accounts.source_account.key().to_bytes(),
        ],
        &ctx.program_id,
    )?;
    let security_associated_account_from = SecurityAssociatedAccount::deserialize(
        &mut &ctx.accounts.security_associated_account_from.data.borrow()[DISCRIMINATOR_LEN..],
    )?;
    verify_pda(
        ctx.accounts.security_associated_account_to.key,
        &[
            SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes(),
            &ctx.accounts.destination_account.key().to_bytes(),
        ],
        &ctx.program_id,
    )?;
    let security_associated_account_to = SecurityAssociatedAccount::deserialize(
        &mut &ctx.accounts.security_associated_account_to.data.borrow()[DISCRIMINATOR_LEN..],
    )?;

    verify_pda(
        ctx.accounts.transfer_rule.key,
        &[
            TRANSFER_RULE_PREFIX.as_bytes(),
            &ctx.accounts.transfer_restriction_data.key().to_bytes(),
            &security_associated_account_from.group.to_le_bytes(),
            &security_associated_account_to.group.to_le_bytes(),
        ],
        &ctx.program_id,
    )?;
    let transfer_rule = TransferRule::deserialize(
        &mut &ctx.accounts.transfer_rule.data.borrow()[DISCRIMINATOR_LEN..],
    )?;
    if transfer_rule.locked_until == 0 {
        return Err(TransferRestrictionsError::TransferGroupNotApproved.into());
    }
    if transfer_rule.locked_until > Clock::get()?.unix_timestamp as u64 {
        return Err(TransferRestrictionsError::TransferRuleNotAllowedUntilLater.into());
    }

    Ok(())
}
