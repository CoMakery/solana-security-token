use anchor_lang::prelude::*;

/// Holds whether or not a claimant has claimed tokens.
///
/// TODO: this is probably better stored as the node that was verified.
#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct ClaimStatus {
    /// If true, the tokens have been claimed.
    pub is_claimed: bool,
    /// Authority that claimed the tokens.
    pub claimant: Pubkey,
    /// When the tokens were claimed.
    pub claimed_at: i64,
    /// Amount of tokens claimed.
    pub amount: u64,
}
