use anchor_lang::prelude::*;

pub mod contexts;
pub mod errors;
pub mod instructions;
pub mod utils;

pub use contexts::*;
pub use utils::*;

declare_id!("4X79YRjz9KNMhdjdxXg2ZNTS3YnMGYdwJkBHnezMJwr3");

#[program]
pub mod access_control {
    use super::*;

    pub fn initialize_access_control(
        ctx: Context<InitializeAccessControl>,
        args: InitializeAccessControlArgs,
    ) -> Result<()> {
        instructions::access_control::initialize(ctx, args)
    }

    pub fn initialize_deployer_role(ctx: Context<InitializeDeployerRole>) -> Result<()> {
        instructions::access_control::initialize_deployer_role(ctx)
    }

    pub fn initialize_wallet_role(ctx: Context<InitializeWalletRole>, role: u8) -> Result<()> {
        instructions::access_control::initialize_wallet_role(ctx, role)
    }

    pub fn update_wallet_role(ctx: Context<UpdateWalletRole>, role: u8) -> Result<()> {
        instructions::access_control::update_wallet_role(ctx, role)
    }

    pub fn mint_securities(ctx: Context<MintSecurities>, amount: u64) -> Result<()> {
        instructions::asset::mint_securities(ctx, amount)
    }

    pub fn burn_securities(ctx: Context<BurnSecurities>, amount: u64) -> Result<()> {
        instructions::asset::burn_securities(ctx, amount)
    }

    pub fn force_transfer_between<'info>(
        ctx: Context<'_, '_, '_, 'info, ForceTransferBetween<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::asset::force_transfer_beetween(ctx, amount)
    }
}
