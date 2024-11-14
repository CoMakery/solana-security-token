use access_control::{program::AccessControl as AccessControlProgram, AccessControl, WalletRole};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{errors::DividendsErrorCode, MerkleDistributor, MAX_IPFS_HASH_LEN};

/// Accounts for [merkle_distributor::new_distributor].
#[derive(Accounts)]
#[instruction(
    bump: u8,
    root: [u8; 32],
    total_claim_amount: u64,
    num_nodes: u64,
    ipfs_hash: String
)]
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
        constraint = authority_wallet_role.has_any_role(access_control::Roles::ContractAdmin as u8 | access_control::Roles::TransferAdmin as u8) @ DividendsErrorCode::Unauthorized,
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

pub fn new_distributor(
    ctx: Context<NewDistributor>,
    _bump: u8,
    root: [u8; 32],
    total_claim_amount: u64,
    num_nodes: u64,
    ipfs_hash: String,
) -> Result<()> {
    if ipfs_hash.len() > MAX_IPFS_HASH_LEN {
        return Err(DividendsErrorCode::InvalidIPFSHashSize.into());
    }

    let distributor = &mut ctx.accounts.distributor;

    distributor.base = ctx.accounts.base.key();
    distributor.bump = ctx.bumps.distributor;

    distributor.root = root;
    distributor.mint = ctx.accounts.mint.key();
    distributor.access_control = ctx.accounts.access_control.key();

    distributor.total_claim_amount = total_claim_amount;
    distributor.num_nodes = num_nodes;
    distributor.total_amount_claimed = 0;
    distributor.num_nodes_claimed = 0;
    distributor.paused = false;
    distributor.ready_to_claim = false;
    distributor.ipfs_hash = ipfs_hash;

    Ok(())
}
