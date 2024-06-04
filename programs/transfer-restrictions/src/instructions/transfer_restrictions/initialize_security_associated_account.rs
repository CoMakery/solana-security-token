use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, InitializeSecurityAssociatedAccount};

pub fn initialize_security_associated_account(
    ctx: Context<InitializeSecurityAssociatedAccount>,
) -> Result<()> {
    let wallet_role = &ctx.accounts.authority_wallet_role;
    if !(wallet_role.has_role(Roles::WalletAdmin) || wallet_role.has_role(Roles::ContractAdmin)) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let security_associated_account = &mut ctx.accounts.security_associated_account;

    security_associated_account.group = ctx.accounts.group.id;
    security_associated_account.holder = *ctx.accounts.holder.to_account_info().key;

    Ok(())
}
