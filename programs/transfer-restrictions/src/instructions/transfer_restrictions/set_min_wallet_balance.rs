use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, SetMinWalletBalance};

pub fn set_min_wallet_balance(
    ctx: Context<SetMinWalletBalance>,
    min_wallet_balance: u64,
) -> Result<()> {
    if !ctx.accounts.authority_wallet_role.has_role(Roles::TransferAdmin) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    transfer_restriction_data.min_wallet_balance = min_wallet_balance;

    Ok(())
}
