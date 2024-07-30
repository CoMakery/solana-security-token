use anchor_lang::prelude::*;

#[error_code]
pub enum TransferRestrictionsError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Max holders reached")]
    MaxHoldersReached,
    #[msg("Transfer rule locked")]
    TransferRuleLocked,
    #[msg("Invalid role")]
    InvalidRole,
    #[msg("All transfers are paused")]
    AllTransfersPaused,
    #[msg("Invalid PDA")]
    InvalidPDA,
    #[msg("Balance is too low")]
    BalanceIsTooLow,
    #[msg("Current wallets count must be zero")]
    CurrentWalletsCountMustBeZero,
    #[msg("Escrow accounts mismatch")]
    EscrowAccountsMismatch,
    #[msg("Invalid transfer restriction holder index")]
    InvalidHolderIndex,
}
