use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, InitializeTransferRestrictionData};

pub fn initialize_data(
    ctx: Context<InitializeTransferRestrictionData>,
    max_holders: u64,
    min_wallet_balance: u64,
) -> Result<()> {
    if !ctx.accounts.authority_wallet_role.has_role(Roles::ContractAdmin) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    transfer_restriction_data.security_token_mint = *ctx.accounts.mint.to_account_info().key;
    transfer_restriction_data.access_control_account =
        *ctx.accounts.access_control_account.to_account_info().key;
    transfer_restriction_data.current_holders_count = 0;
    transfer_restriction_data.holder_ids = 0;
    transfer_restriction_data.max_holders = max_holders;
    transfer_restriction_data.min_wallet_balance = min_wallet_balance;
    transfer_restriction_data.paused = false;

    let zero_transfer_restriction_group = &mut ctx.accounts.zero_transfer_restriction_group;
    zero_transfer_restriction_group.id = 0;
    zero_transfer_restriction_group.current_holders_count = 0;
    zero_transfer_restriction_group.max_holders = max_holders;
    zero_transfer_restriction_group.transfer_restriction_data = transfer_restriction_data.key();

    Ok(())
}
