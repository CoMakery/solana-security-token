use anchor_lang::prelude::*;

#[error_code]
pub enum SolanaSecurityTokenError {
    #[msg("Max holders reached")]
    MaxHoldersReached,
}
