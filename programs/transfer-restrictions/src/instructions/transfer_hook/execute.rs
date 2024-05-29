use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::spl_token_2022::extension::permanent_delegate::PermanentDelegate,
    token_interface::get_mint_extension_data,
};

use crate::{errors::TransferRestrictionsError, ExecuteTransferHook};

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

    // TODO: add transfer restrictions checks here
    let transfer_rule = &ctx.accounts.transfer_rule;

    if transfer_rule.locked_until > Clock::get()?.unix_timestamp as u64 {
        return Err(TransferRestrictionsError::TransferRuleLocked.into());
    }

    Ok(())
}
