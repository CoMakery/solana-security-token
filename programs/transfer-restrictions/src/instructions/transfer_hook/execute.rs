use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::spl_token_2022::extension::permanent_delegate::PermanentDelegate,
    token_interface::get_mint_extension_data,
};

use crate::{
    common::DISCRIMINATOR_LEN, errors::TransferRestrictionsError, verify_pda, ExecuteTransferHook,
    TransferRule, TRANSFER_RULE_PREFIX,
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

    let transfer_restriction_data = &ctx.accounts.transfer_restriction_data;
    if transfer_restriction_data.paused {
        return Err(TransferRestrictionsError::AllTransfersPaused.into());
    }

    if ctx.accounts.transfer_rule.data_is_empty() {
        return Err(ErrorCode::AccountNotInitialized.into());
    }

    verify_pda(
        ctx.accounts.transfer_rule.key,
        &[
            TRANSFER_RULE_PREFIX.as_bytes(),
            &ctx.accounts
                .transfer_restriction_group_from
                .key()
                .to_bytes(),
            &ctx.accounts.transfer_restriction_group_to.key().to_bytes(),
        ],
        ctx.program_id,
    )?;

    // TODO: add transfer restrictions checks here
    let transfer_rule = TransferRule::deserialize(
        &mut &ctx.accounts.transfer_rule.data.borrow()[DISCRIMINATOR_LEN..],
    )?;

    if transfer_rule.locked_until > Clock::get()?.unix_timestamp as u64 {
        return Err(TransferRestrictionsError::TransferRuleLocked.into());
    }

    Ok(())
}
