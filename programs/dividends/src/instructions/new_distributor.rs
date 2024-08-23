use access_control::{program::AccessControl as AccessControlProgram, AccessControl, WalletRole};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{errors::DividendsErrorCode, MerkleDistributor};

/// Accounts for [merkle_distributor::new_distributor].
#[derive(Accounts)]
pub struct NewDistributor<'info> {
    /// Base key of the distributor.
    pub base: Signer<'info>,

    /// [MerkleDistributor].
    #[account(
        init,
        seeds = [
            b"MerkleDistributor".as_ref(),
            base.key().to_bytes().as_ref()
        ],
        bump,
        space = 8 + MerkleDistributor::INIT_SPACE,
        payer = payer
    )]
    pub distributor: Account<'info, MerkleDistributor>,

    /// The mint to distribute.
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// Authority wallet role to create the distributor.
    #[account(
        constraint = authority_wallet_role.owner == payer.key(),
        constraint = authority_wallet_role.has_role(access_control::Roles::ContractAdmin) @ DividendsErrorCode::Unauthorized,
        constraint = authority_wallet_role.access_control == access_control.key(),
        owner = AccessControlProgram::id(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    /// Access Control for Security Token.
    #[account(owner = AccessControlProgram::id())]
    pub access_control: Account<'info, AccessControl>,

    /// Payer to create the distributor.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The [System] program.
    pub system_program: Program<'info, System>,
}

// TODO: only contract admin can create a new distributor
pub fn new_distributor(
    ctx: Context<NewDistributor>,
    _bump: u8,
    root: [u8; 32],
    max_total_claim: u64,
    max_num_nodes: u64,
) -> Result<()> {
    let distributor = &mut ctx.accounts.distributor;

    distributor.base = ctx.accounts.base.key();
    distributor.bump = ctx.bumps.distributor;

    distributor.root = root;
    distributor.mint = ctx.accounts.mint.key();
    distributor.access_control = ctx.accounts.access_control.key();

    distributor.max_total_claim = max_total_claim;
    distributor.max_num_nodes = max_num_nodes;
    distributor.total_amount_claimed = 0;
    distributor.num_nodes_claimed = 0;

    Ok(())
}
