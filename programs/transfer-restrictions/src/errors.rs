use anchor_lang::prelude::*;

#[error_code]
pub enum TransferRestrictionsError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Max holders reached")]
    MaxHoldersReached,
    #[msg("Transfer rule locked")]
    TransferRuleLocked,
    #[msg("All transfers are paused")]
    AllTransfersPaused,
}
