use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, InitializeSecurityAssociatedAccount};

pub fn initialize_security_associated_account(
    ctx: Context<InitializeSecurityAssociatedAccount>,
) -> Result<()> {
    let wallet_role = &ctx.accounts.authority_wallet_role;
    if !wallet_role.has_any_role(Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let security_associated_account = &mut ctx.accounts.security_associated_account;

    security_associated_account.group = ctx.accounts.group.id;
    security_associated_account.holder = Some(ctx.accounts.holder.key());

    let group = &mut ctx.accounts.group;
    let holder_group = &mut ctx.accounts.holder_group;
    holder_group.current_wallets_count = holder_group.current_wallets_count.checked_add(1).unwrap();
    if holder_group.current_wallets_count == 1 {
        group.current_holders_count = group.current_holders_count.checked_add(1).unwrap();
    }
    if group.current_holders_count > group.max_holders && group.max_holders != 0 {
        return Err(TransferRestrictionsError::MaxHoldersReachedInsideTheGroup.into());
    }

    let holder = &mut ctx.accounts.holder;
    holder.current_wallets_count = holder.current_wallets_count.checked_add(1).unwrap();
    
    Ok(())
}
