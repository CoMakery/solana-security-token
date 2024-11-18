use crate::{errors::DividendsErrorCode, MerkleDistributor};
use access_control::{program::AccessControl as AccessControlProgram, AccessControl, WalletRole};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(paused: bool)]
pub struct Pause<'info> {
    /// The [MerkleDistributor].
    #[account(mut,
        constraint = distributor.access_control == access_control.key(),
    )]
    pub distributor: Account<'info, MerkleDistributor>,

    /// Authority wallet role to pause the distributor.
    #[account(
        constraint = authority_wallet_role.owner == authority.key(),
        constraint = authority_wallet_role.has_role(access_control::Roles::ContractAdmin) @ DividendsErrorCode::Unauthorized,
        constraint = authority_wallet_role.access_control == access_control.key(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    /// Access Control for Security Token.
    #[account(owner = AccessControlProgram::id())]
    pub access_control: Account<'info, AccessControl>,

    /// Payer and authority to pause the distributor.
    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn pause(ctx: Context<Pause>, paused: bool) -> Result<()> {
    if paused == ctx.accounts.distributor.paused {
        return Err(DividendsErrorCode::ValueUnchanged.into());
    }

    let distributor = &mut ctx.accounts.distributor;
    distributor.paused = paused;

    Ok(())
}
