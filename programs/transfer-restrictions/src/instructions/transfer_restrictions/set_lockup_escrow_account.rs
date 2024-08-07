use access_control::Roles;
use anchor_lang::{prelude::*, solana_program::program_memory::sol_memcmp, Discriminator};

use crate::{errors::TransferRestrictionsError, SetLockupEscrowAccount};

pub fn set_lockup_escrow_account(ctx: Context<SetLockupEscrowAccount>) -> Result<()> {
    if !ctx
        .accounts
        .authority_wallet_role
        .has_role(Roles::ContractAdmin)
    {
        return Err(TransferRestrictionsError::Unauthorized.into());
    }

    let discriminator = TokenLockData::discriminator();
    let tokenlock_account = &ctx.accounts.tokenlock_account;
    let tokenlock_account_data = tokenlock_account.try_borrow_data()?;
    if sol_memcmp(&discriminator, &tokenlock_account_data, discriminator.len()) != 0 {
        return Err(TransferRestrictionsError::IncorrectTokenlockAccount.into());
    }
    let escrow_account = parse_escrow_account(&tokenlock_account_data);
    if escrow_account != *ctx.accounts.escrow_account.to_account_info().key {
        return Err(TransferRestrictionsError::EscrowAccountsMismatch.into());
    }

    let transfer_restriction_data = &mut ctx.accounts.transfer_restriction_data;
    transfer_restriction_data.lockup_escrow_account = Some(escrow_account);

    let escrow_security_associated_token_account =
        &mut ctx.accounts.escrow_security_associated_account;
    escrow_security_associated_token_account.group = 0;
    escrow_security_associated_token_account.holder = None;

    Ok(())
}

// read escrow account from tokenlock account data
fn parse_escrow_account(data: &[u8]) -> Pubkey {
    const ESCROW_ACCOUNT_OFFSET: usize = 72;
    return Pubkey::try_from_slice(&data[ESCROW_ACCOUNT_OFFSET..ESCROW_ACCOUNT_OFFSET + 32])
        .unwrap();
}

// Duplicate tokenlock accounts here because we cannot import them
// from the tokenlock program due to the circular dependency
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
struct ReleaseSchedule {
    pub release_count: u32,
    pub delay_until_first_release_in_seconds: u64,
    pub initial_release_portion_in_bips: u32,
    pub period_between_releases_in_seconds: u64,
    pub signer_hash: [u8; 20],
}

#[account]
#[derive(Default)]
struct TokenLockData {
    pub access_control: Pubkey,
    pub mint_address: Pubkey,
    pub escrow_account: Pubkey,
    pub transfer_restrictions_data: Pubkey,
    pub bump_seed: u8,
    pub max_release_delay: u64,
    pub min_timelock_amount: u64,
    pub release_schedules: Vec<ReleaseSchedule>,
}
