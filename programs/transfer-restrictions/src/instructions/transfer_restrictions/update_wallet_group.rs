use crate::{contexts::UpdateWalletGroup, errors::TransferRestrictionsError};
use access_control::Roles;
use anchor_lang::prelude::*;

pub fn update_wallet_group(ctx: Context<UpdateWalletGroup>) -> Result<()> {
    let wallet_role = &ctx.accounts.authority_wallet_role;
    if !wallet_role.has_any_role(Roles::WalletsAdmin as u8 | Roles::TransferAdmin as u8) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let group_new = &mut ctx.accounts.transfer_restriction_group_new;
    let holder_group_current = &mut ctx.accounts.holder_group_current;
    let holder_group_new = &mut ctx.accounts.holder_group_new;

    // holder join new group if it is the first wallet
    if holder_group_new.current_wallets_count == 0 {
        group_new.current_holders_count = group_new.current_holders_count.checked_add(1).unwrap();
    }
    // check group max count
    if group_new.current_holders_count > group_new.max_holders {
        return Err(TransferRestrictionsError::MaxHoldersReached.into());
    }

    // if group is changed, update wallets count
    if holder_group_current.group != holder_group_new.group {
        holder_group_current.current_wallets_count = holder_group_current
            .current_wallets_count
            .checked_sub(1)
            .unwrap();
        holder_group_new.current_wallets_count = holder_group_new
            .current_wallets_count
            .checked_add(1)
            .unwrap();
    }

    // holder leave current group if it is the last wallet
    if holder_group_current.current_wallets_count == 0 {
        let group_current = &mut ctx.accounts.transfer_restriction_group_current;
        group_current.current_holders_count =
            group_current.current_holders_count.checked_sub(1).unwrap();
    }

    let security_associated_account = &mut ctx.accounts.security_associated_account;
    security_associated_account.group = group_new.id;

    Ok(())
}
