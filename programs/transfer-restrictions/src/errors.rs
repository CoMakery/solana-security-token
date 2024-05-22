use anchor_lang::prelude::*;

#[error_code]
pub enum SolanaSecurityTokenError {
    #[msg("Max holders reached")]
    MaxHoldersReached,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Transfer rule locked")]
    TransferRuleLocked,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Invalid role")]
    InvalidRole,
}
