use anchor_lang::prelude::*;

pub const MAX_IPFS_HASH_LEN: usize = 64;
/// State for the account which distributes tokens.
#[account]
#[derive(Default, InitSpace)]
pub struct MerkleDistributor {
    /// Base key used to generate the PDA.
    pub base: Pubkey,
    /// Bump seed.
    pub bump: u8,

    /// The 256-bit merkle root.
    pub root: [u8; 32],

    /// [Mint] of the token to be distributed.
    pub mint: Pubkey,
    /// Number of tokens that can be claimed from this [MerkleDistributor].
    pub total_claim_amount: u64,
    /// Number of nodes that can be claimed from this [MerkleDistributor].
    pub num_nodes: u64,
    /// Total amount of tokens that have been claimed.
    pub total_amount_claimed: u64,
    /// Number of nodes that have been claimed.
    pub num_nodes_claimed: u64,
    /// Access control for the [MerkleDistributor] and Security Token.
    pub access_control: Pubkey,
    /// The [MerkleDistributor] is paused.
    pub paused: bool,
    /// The [MerkleDistributor] is ready to claim.
    pub ready_to_claim: bool,
    /// IPFS hash of the serialized merkle tree.
    #[max_len(MAX_IPFS_HASH_LEN)]
    pub ipfs_hash: String,
}
