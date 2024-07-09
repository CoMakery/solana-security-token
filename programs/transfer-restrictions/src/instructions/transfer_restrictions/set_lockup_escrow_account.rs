use access_control::Roles;
use anchor_lang::prelude::*;

use crate::{errors::TransferRestrictionsError, SetLockupEscrowAccount};

pub fn set_lockup_escrow_account(
    ctx: Context<SetLockupEscrowAccount>,
) -> Result<()> {
    if !ctx.accounts.authority_wallet_role.has_role(Roles::ContractAdmin) {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let tokenlock_account = &ctx.accounts.tokenlock_account;
    let tokenlock_account_data = tokenlock_account.try_borrow_data()?;
    let escrow_account = parse_escrow_account(&tokenlock_account_data);
    if escrow_account != *ctx.accounts.escrow_account.to_account_info().key {
        return Err(TransferRestrictionsError::EscrowAccountsMismatch.into());
    }

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    transfer_restriction_data.lockup_escrow_account = Some(escrow_account);

    Ok(())
}

// read escrow account from tokenlock account data
fn parse_escrow_account(data: &[u8]) -> Pubkey {
    const ESCROW_ACCOUNT_OFFSET: usize = 72;
    return Pubkey::try_from_slice(&data[ESCROW_ACCOUNT_OFFSET..ESCROW_ACCOUNT_OFFSET + 32]).unwrap();
}
