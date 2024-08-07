use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, RevokeSecurityAssociatedAccount};

pub fn revoke_security_associated_account(
    ctx: Context<RevokeSecurityAssociatedAccount>,
) -> Result<()> {
    let wallet_role = &ctx.accounts.authority_wallet_role;
    if !wallet_role.has_any_role(Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let holder_group = &mut ctx.accounts.holder_group;
    let holder = &mut ctx.accounts.holder;
    // It is mostly not possible to have a holder or holder group with no wallets, but just in case
    if holder_group.current_wallets_count == 0 || holder.current_wallets_count == 0 {
        return Err(TransferRestrictionsError::NoWalletsInGroup.into());
    }
    holder_group.current_wallets_count = holder_group.current_wallets_count.checked_sub(1).unwrap();
    holder.current_wallets_count = holder.current_wallets_count.checked_sub(1).unwrap();

    if holder_group.current_wallets_count == 0 {
        // Remove holder from group
        let group = &mut ctx.accounts.group;
        group.current_holders_count = group.current_holders_count.checked_sub(1).unwrap();
    }

    Ok(())
}
