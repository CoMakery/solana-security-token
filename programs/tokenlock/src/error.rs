use anchor_lang::prelude::*;

#[error_code]
pub enum TokenlockErrors {
    #[msg("Invalid tokenlock account data")]
    InvalidTokenlockAccount,

    #[msg("Max release delay must be greater or equal to 1")]
    MaxReleaseDelayLessThanOne,

    #[msg("Min timelock amount must be greater or equal to 1")]
    MinTimelockAmountLessThanOne,

    #[msg("Amount < min funding")]
    AmountLessThanMinFunding,

    #[msg("Insufficient data space, Tokenlock account is full")]
    InsufficientTokenLockDataSpace,

    #[msg("Insufficient data space, Timelock account is full")]
    InsufficientDataSpace,

    #[msg("Invalid scheduleId")]
    InvalidScheduleId,

    #[msg("Per release token less than 1")]
    PerReleaseTokenLessThanOne,

    #[msg("Commencement time out of range")]
    CommencementTimeoutOfRange,

    #[msg("Initial release out of range")]
    InitialReleaseTimeoutOfRange,

    #[msg("Max 10 cancelableBy addressees")]
    Max10CancelableAddresses,

    #[msg("Invalid timelock id")]
    InvalidTimelockId,

    #[msg("Timelock has no value left")]
    TimelockHasntValue,

    #[msg("Permission denied, address must be present in cancelableBy")]
    HasntCancelTimelockPermission,

    #[msg("Amount bigger than unlocked")]
    AmountBiggerThanUnlocked,

    #[msg("Amount must be bigger than zero")]
    AmountMustBeBiggerThanZero,

    #[msg("Bad transfer")]
    BadTransfer,

    #[msg("First release delay < 0")]
    FirstReleaseDelayLessThanZero,

    #[msg("Release Period < 0")]
    ReleasePeriodLessThanZero,

    #[msg("First release > max delay")]
    FirstReleaseDelayBiggerThanMaxDelay,

    #[msg("Release count less than 1")]
    ReleaseCountLessThanOne,

    #[msg("Init release portion bigger than 100%")]
    InitReleasePortionBiggerThan100Percent,

    #[msg("Release period is zero")]
    ReleasePeriodZero,

    #[msg("Init release portion must be 100%")]
    InitReleasePortionMustBe100Percent,

    #[msg("Balance is insufficient!")]
    BalanceIsInsufficient,

    #[msg("Mismatched token!")]
    MisMatchedToken,

    #[msg("Mismatched escrow account!")]
    MisMatchedEscrow,

    #[msg("Hash already exists!")]
    HashAlreadyExists,

    #[msg("Duplicated cancelable!")]
    DuplicatedCancelable,

    #[msg("Schedules count reached maximium.")]
    SchedulesCountReachedMax,

    #[msg("Cancelables count reached maximium.")]
    CancelablesCountReachedMax,

    #[msg("Wrong tokenlock account.")]
    IncorrectTokenlockAccount,

    #[msg("Wrong escrow account")]
    IncorrectEscrowAccount,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Invalid access control account")]
    InvalidAccessControlAccount,

    #[msg("Invalid transfer restriction data")]
    InvalidTransferRestrictionData,

    #[msg("Invalid account owner")]
    InvalidAccountOwner,

    #[msg("Invalid funder account")]
    InvalidFunderAccount,
}
