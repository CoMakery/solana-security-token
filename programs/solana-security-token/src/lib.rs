use anchor_lang::prelude::*;

mod instructions;

mod contexts;
use contexts::*;

mod errors;

declare_id!("6yEnqdEjX3zBBDkzhwTRGJwv1jRaN4QE4gywmgdcfPBZ");

#[program]
pub mod solana_security_token {
    use super::*;

    pub fn initialize_access_control(ctx: Context<InitializeAccessControl>) -> Result<()> {
        instructions::access_control::initialize(ctx)
    }

    pub fn initialize_transfer_restrictions_data(
        ctx: Context<InitializeTransferRestrictionData>,
        max_holders: u64,
    ) -> Result<()> {
        instructions::transfer_restrictions::initialize_data(ctx, max_holders)
    }

    pub fn initialize_transfer_restriction_group(
        ctx: Context<InitializeTransferRestrictionGroup>,
        id: u64,
    ) -> Result<()> {
        instructions::transfer_restrictions::initialize_group(ctx, id)
    }

    pub fn initialize_transfer_restriction_holder(
        ctx: Context<InitializeTransferRestrictionHolder>,
        id: u64,
    ) -> Result<()> {
        instructions::transfer_restrictions::initialize_holder(ctx, id)
    }

    pub fn initialize_transfer_rule(
        ctx: Context<InitializeTransferRule>,
        lock_until: u64,
    ) -> Result<()> {
        instructions::transfer_restrictions::initialize_transfer_rule(ctx, lock_until)
    }

    pub fn initialize_security_associated_account(
        ctx: Context<InitializeSecurityAssociatedAccount>,
    ) -> Result<()> {
        instructions::transfer_restrictions::initialize_security_associated_account(ctx)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
