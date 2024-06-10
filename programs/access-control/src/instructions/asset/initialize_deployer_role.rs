use crate::{contexts::InitializeDeployerRole, Roles};
use anchor_lang::prelude::*;

pub fn initialize_deployer_role(ctx: Context<InitializeDeployerRole>) -> Result<()> {
    let wallet_role = &mut ctx.accounts.wallet_role;
    wallet_role.role = Roles::ContractAdmin as u8;

    Ok(())
}
