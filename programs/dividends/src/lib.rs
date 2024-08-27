use anchor_lang::prelude::*;

pub mod states;
use states::*;
pub mod errors;
pub mod events;
pub mod merkle_proof;
pub mod instructions;
use instructions::*;

declare_id!("BvQwgkeevtxXrUsWtZU3fUu5R3qTYne2XfrQp8dXXut3");

#[program]
pub mod dividends {
    use super::*;

    /// Creates a new [MerkleDistributor].
    /// After creating this [MerkleDistributor], the account should be seeded with tokens via its ATA.
    pub fn new_distributor(
        ctx: Context<NewDistributor>,
        _bump: u8,
        root: [u8; 32],
        max_total_claim: u64,
        max_num_nodes: u64,
    ) -> Result<()> {
      instructions::new_distributor(ctx, _bump, root, max_total_claim, max_num_nodes)
    }

    /// Claims tokens from the [MerkleDistributor].
    pub fn claim(
        ctx: Context<Claim>,
        _bump: u8,
        index: u64,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::claim(ctx, _bump, index, amount, proof)
    }
}
