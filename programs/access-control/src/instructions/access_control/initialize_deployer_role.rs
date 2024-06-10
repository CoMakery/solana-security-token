use crate::{contexts::InitializeDeployerRole, Roles};
use anchor_lang::prelude::*;

pub fn initialize_deployer_role(ctx: Context<InitializeDeployerRole>) -> Result<()> {
    let wallet_role = &mut ctx.accounts.wallet_role;
    wallet_role.role = Roles::ContractAdmin as u8;
    wallet_role.owner = ctx.accounts.payer.key();
    wallet_role.access_control = ctx.accounts.access_control.key();

    Ok(())
}
