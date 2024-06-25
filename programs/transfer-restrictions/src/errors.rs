use anchor_lang::prelude::*;

#[error_code]
pub enum TransferRestrictionsError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Max holders reached")]
    MaxHoldersReached,
    #[msg("Transfer rule locked")]
    TransferRuleLocked,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Invalid role")]
    InvalidRole,
    #[msg("Balance is too low")]
    BalanceIsTooLow,
}
