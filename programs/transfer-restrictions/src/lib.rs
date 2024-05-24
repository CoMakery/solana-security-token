use anchor_lang::prelude::*;

pub mod contexts;
pub mod errors;
pub mod instructions;
pub mod utils;

pub use contexts::*;
pub use utils::*;

declare_id!("6yEnqdEjX3zBBDkzhwTRGJwv1jRaN4QE4gywmgdcfPBZ");

#[program]
pub mod transfer_restrictions {
    use super::*;

    pub fn initialize_access_control(
        ctx: Context<InitializeAccessControl>,
        args: InitializeAccessControlArgs,
    ) -> Result<()> {
        instructions::access_control::initialize(ctx, args)
    }

    pub fn initialize_wallet_role(ctx: Context<InitializeWalletRole>, role: u8) -> Result<()> {
        instructions::access_control::initialize_wallet_role(ctx, role)
    }

    pub fn update_wallet_role(ctx: Context<UpdateWalletRole>, role: u8) -> Result<()> {
        instructions::access_control::update_wallet_role(ctx, role)
    }

    /// execute transfer hook
    #[interface(spl_transfer_hook_interface::execute)]
    pub fn execute_transaction(ctx: Context<ExecuteTransferHook>, amount: u64) -> Result<()> {
        instructions::access_control::handler(ctx, amount)
    }

    pub fn mint_securities(ctx: Context<MintSecurities>, amount: u64) -> Result<()> {
        instructions::access_control::mint_securities(ctx, amount)
    }

    pub fn burn_securities(ctx: Context<BurnSecurities>, amount: u64) -> Result<()> {
        instructions::access_control::burn_securities(ctx, amount)
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

    pub fn update_wallet_group(ctx: Context<UpdateWalletGroup>) -> Result<()> {
        instructions::transfer_restrictions::update_wallet_group(ctx)
    }
}
