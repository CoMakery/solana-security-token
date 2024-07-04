use access_control::Roles;
use anchor_lang::prelude::*;

use crate::errors::*;
use crate::InitializeTransferRestrictionHolder;

pub fn initialize_holder(ctx: Context<InitializeTransferRestrictionHolder>, id: u64) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_any_role(Roles::TransferAdmin as u8 | Roles::WalletsAdmin as u8)
    {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let transfer_restriction_holder = &mut ctx.accounts.transfer_restriction_holder;
    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    if transfer_restriction_data.current_holders_count == transfer_restriction_data.max_holders {
        return Err(TransferRestrictionsError::MaxHoldersReached.into());
    }

    transfer_restriction_holder.transfer_restriction_data = transfer_restriction_data.key();
    transfer_restriction_holder.id = id;
    transfer_restriction_holder.current_wallets_count = 0;
    transfer_restriction_holder.active = true;
    transfer_restriction_data.current_holders_count = transfer_restriction_data
        .current_holders_count
        .checked_add(1)
        .unwrap();
    transfer_restriction_data.holder_ids =
        transfer_restriction_data.holder_ids.checked_add(1).unwrap();

    Ok(())
}
