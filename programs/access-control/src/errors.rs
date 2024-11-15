use anchor_lang::prelude::*;

#[error_code]
pub enum AccessControlError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid role")]
    InvalidRole,
    #[msg("Cannot mint more than max total supply")]
    MintExceedsMaxTotalSupply,
    #[msg("Wrong tokenlock account")]
    IncorrectTokenlockAccount,
    #[msg("Mismatched escrow account")]
    MismatchedEscrowAccount,
    #[msg("Cannot burn securities within lockup; cancel the lockup first")]
    CantBurnSecuritiesWithinLockup,
    #[msg("Cannot force transfer between lockup accounts")]
    CantForceTransferBetweenLockup,
    #[msg("The provided value is already set. No changes were made")]
    ValueUnchanged,
}
