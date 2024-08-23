use anchor_lang::prelude::*;

#[error_code]
pub enum DividendsErrorCode {
    #[msg("Invalid Merkle proof")]
    InvalidProof,
    #[msg("Drop already claimed")]
    DropAlreadyClaimed,
    #[msg("Exceeded maximum claim amount")]
    ExceededMaxClaim,
    #[msg("Exceeded maximum number of claimed nodes")]
    ExceededMaxNumNodes,
    #[msg("Account is not authorized to execute this instruction")]
    Unauthorized,
    #[msg("Token account owner did not match intended owner")]
    OwnerMismatch,
    #[msg("Keys must not match")]
    KeysMustNotMatch,
    #[msg("Invalid funding amount")]
    InvalidFundingAmount,
}