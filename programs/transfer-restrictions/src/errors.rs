use anchor_lang::prelude::*;

#[error_code]
pub enum TransferRestrictionsError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Max holders reached")]
    MaxHoldersReached,
    #[msg("Transfer rule not allowed until later")]
    TransferRuleNotAllowedUntilLater,
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
    #[msg("Max holders reached inside the group")]
    MaxHoldersReachedInsideTheGroup,
    #[msg("Transfer group not approved")]
    TransferGroupNotApproved,
    #[msg("Wrong tokenlock account")]
    IncorrectTokenlockAccount,
    #[msg("Transfer rule account data is empty")]
    TransferRuleAccountDataIsEmtpy,
    #[msg("Security associated account data is empty")]
    SecurityAssociatedAccountDataIsEmtpy,
    #[msg("Transfer restrictions account data is empty")]
    TransferRestrictionsAccountDataIsEmtpy,
    #[msg("No wallets in group")]
    NoWalletsInGroup,
    #[msg("New group is the same as the current group")]
    NewGroupIsTheSameAsTheCurrentGroup,
}
