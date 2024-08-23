use anchor_lang::prelude::*;

/// State for the account which distributes tokens.
#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct MerkleDistributor {
    /// Base key used to generate the PDA.
    pub base: Pubkey,
    /// Bump seed.
    pub bump: u8,

    /// The 256-bit merkle root.
    pub root: [u8; 32],

    /// [Mint] of the token to be distributed.
    pub mint: Pubkey,
    /// Maximum number of tokens that can ever be claimed from this [MerkleDistributor].
    pub max_total_claim: u64,
    /// Maximum number of nodes that can ever be claimed from this [MerkleDistributor].
    pub max_num_nodes: u64,
    /// Total amount of tokens that have been claimed.
    pub total_amount_claimed: u64,
    /// Number of nodes that have been claimed.
    pub num_nodes_claimed: u64,
    /// Access control for the [MerkleDistributor] and Security Token.
    pub access_control: Pubkey,
    /// The [MerkleDistributor] is paused.
    pub paused: bool,
}
