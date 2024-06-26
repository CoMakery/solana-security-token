use anchor_lang::prelude::*;

#[error_code]
pub enum AccessControlError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid role")]
    InvalidRole,
    #[msg("Cannot mint more than max total supply")]
    MintExceedsMaxTotalSupply,
}
