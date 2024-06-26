use crate::{contexts::UpdateWalletGroup, errors::TransferRestrictionsError};
use access_control::Roles;
use anchor_lang::prelude::*;

pub fn update_wallet_group(ctx: Context<UpdateWalletGroup>) -> Result<()> {
    let wallet_role = &ctx.accounts.authority_wallet_role;
    if !(wallet_role.has_role(Roles::WalletsAdmin) || wallet_role.has_role(Roles::ContractAdmin)) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }
    // check group max count
    // add previous group account in order to decrease walletsCount

    let transfer_restriction_data = &ctx.accounts.transfer_restriction_data;
    let associated_token_account = &ctx.accounts.associated_token_account;
    let group = &ctx.accounts.group;

    if !transfer_restriction_data.can_leave_group(group.id, associated_token_account.amount) {
        return Err(TransferRestrictionsError::BalanceIsTooLow.into());
    }

    let security_associated_account = &mut ctx.accounts.security_associated_account;
    security_associated_account.group = group.id;

    Ok(())
}
