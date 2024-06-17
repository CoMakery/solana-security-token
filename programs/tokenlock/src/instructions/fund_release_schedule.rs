use access_control::{
    program::AccessControl as AccessControlProgram, AccessControl, WalletRole, ADMIN_ROLES,
};
use anchor_lang::{prelude::*, Discriminator};
use anchor_spl::{
    token_2022::spl_token_2022::onchain::invoke_transfer_checked,
    token_interface::{Mint, Token2022, TokenAccount},
};
use solana_program::program_memory::{sol_memcmp, sol_memcpy};

use crate::{
    common::PUBKEY_SIZE, utils, Timelock, TimelockData, TokenLockData,
    TokenLockDataWrapper, TokenlockErrors,
};

#[derive(Accounts)]
pub struct FundReleaseSchedule<'info> {
    /// CHECK: implemented own serialization in order to save compute units
    pub tokenlock_account: AccountInfo<'info>,

    #[account(mut,
        constraint = timelock_account.tokenlock_account == *tokenlock_account.key,
    )]
    pub timelock_account: Account<'info, TimelockData>,

    #[account(mut,
        token::mint = mint_address,
        token::token_program = token_program,
    )]
    pub escrow_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint = authority_wallet_role.owner == authority.key(),
        constraint = authority_wallet_role.access_control == access_control.key(),
        owner = AccessControlProgram::id(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(owner = AccessControlProgram::id())]
    pub access_control: Account<'info, AccessControl>,

    #[account(
        mint::token_program = token_program,
        constraint = mint_address.key() == access_control.mint,
    )]
    pub mint_address: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::token_program = token_program,
        associated_token::mint = mint_address,
        associated_token::authority = authority,
        constraint = escrow_account.mint == from.mint
    )]
    pub from: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        constraint = *to.key == timelock_account.target_account,
    )]
    /// CHECK: System Account which identify target user wallet
    /// with which will be linked timelocks
    pub to: AccountInfo<'info>,

    pub token_program: Program<'info, Token2022>,
}

pub fn fund_release_schedule<'info>(
    ctx: Context<'_, '_, '_, 'info, FundReleaseSchedule<'info>>,
    uuid: [u8; 16],
    amount: u64,
    commencement_timestamp: u64,
    schedule_id: u16,
    cancelable_by: Vec<Pubkey>,
) -> Result<()> {
    let tokenlock_account = &ctx.accounts.tokenlock_account;
    let tokenlock_account_data = tokenlock_account.try_borrow_data()?;
    let discriminator = TokenLockData::discriminator();
    if sol_memcmp(&discriminator, &tokenlock_account_data, discriminator.len()) != 0 {
        return Err(TokenlockErrors::IncorrectTokenlockAccount.into());
    }

    if !ctx.accounts.authority_wallet_role.has_any_role(ADMIN_ROLES) {
        return Err(TokenlockErrors::Unauthorized.into());
    }

    if ctx.accounts.access_control.key()
        != TokenLockDataWrapper::access_control(&tokenlock_account_data)
    {
        return Err(TokenlockErrors::InvalidAccessControlAccount.into());
    }

    let mint_address = TokenLockDataWrapper::mint_address(&tokenlock_account_data);
    let escrow_account = TokenLockDataWrapper::escrow_account(&tokenlock_account_data);

    //constraint
    if mint_address != ctx.accounts.from.mint {
        return Err(TokenlockErrors::MisMatchedToken.into());
    }
    if escrow_account != *ctx.accounts.escrow_account.to_account_info().key {
        return Err(TokenlockErrors::MisMatchedEscrow.into());
    }

    //check param
    let now_ts = utils::get_unix_timestamp();
    if cancelable_by.len() > Timelock::CANCELABLE_BY_COUNT_MAX as usize {
        return Err(TokenlockErrors::Max10CancelableAddresses.into());
    }

    //check params
    if amount < TokenLockDataWrapper::min_timelock_amount(&tokenlock_account_data) {
        return Err(TokenlockErrors::AmountLessThanMinFunding.into());
    }

    if schedule_id >= TokenLockDataWrapper::schedule_count(&tokenlock_account_data) {
        return Err(TokenlockErrors::InvalidScheduleId.into());
    }

    let schedule =
        TokenLockDataWrapper::get_schedule(&tokenlock_account_data, schedule_id).unwrap();
    if amount < (schedule.release_count as u64) {
        return Err(TokenlockErrors::PerReleaseTokenLessThanOne.into());
    }

    let max_delay: u64 = TokenLockDataWrapper::max_release_delay(&tokenlock_account_data);
    let commencement_ts = commencement_timestamp;
    let max_allowed_timestamp = now_ts.checked_add(max_delay).unwrap();
    if commencement_ts > max_allowed_timestamp {
        return Err(TokenlockErrors::CommencementTimeoutOfRange.into());
    }
    let first_release_ts =
        commencement_ts.checked_add(schedule.delay_until_first_release_in_seconds);
    if first_release_ts.is_none() || first_release_ts.unwrap() > max_allowed_timestamp {
        return Err(TokenlockErrors::InitialReleaseTimeoutOfRange.into());
    }

    //check cancelable duplicating
    for i in 0..cancelable_by.len() {
        for j in i + 1..cancelable_by.len() {
            if cancelable_by[i] == cancelable_by[j] {
                return Err(TokenlockErrors::DuplicatedCancelable.into());
            }
        }
    }

    let hash = utils::calc_signer_hash(ctx.accounts.authority.key, uuid);
    let mut timelock = Timelock {
        schedule_id,
        commencement_timestamp: commencement_ts,
        tokens_transferred: 0,
        total_amount: amount,
        cancelable_by_count: cancelable_by.len() as u8,
        cancelable_by: [0; 10],
        signer_hash: hash,
    };

    let timelock_account = &mut ctx.accounts.timelock_account;
    if timelock_account.is_duplicated_timelock(&timelock) == true {
        return Err(TokenlockErrors::HashAlreadyExists.into());
    }

    //check cancelables
    let mut cancelable_by_indexes: Vec<u8> = vec![];
    let mut cancelable_by_new_count: u8 = 0;
    for pubkey in &cancelable_by {
        let idx = timelock_account.get_cancelable_index(pubkey);
        if idx.is_none() {
            match (timelock_account.cancelables.len() as u8).checked_add(cancelable_by_new_count) {
                None => return Err(TokenlockErrors::CancelablesCountReachedMax.into()),
                Some(cancelable_by_idx_new) => {
                    cancelable_by_indexes.push(cancelable_by_idx_new);
                    cancelable_by_new_count = cancelable_by_new_count.checked_add(1).unwrap();
                }
            }
        } else {
            cancelable_by_indexes.push(idx.unwrap());
        }
    }

    //check total cancelables count
    let cancelable_by_new_len = timelock_account
        .cancelables
        .len()
        .checked_add(cancelable_by_new_count as usize);
    if cancelable_by_new_len.is_none()
        || cancelable_by_new_len.unwrap() > Timelock::MAX_CANCELABLES_COUNT
    {
        return Err(TokenlockErrors::CancelablesCountReachedMax.into());
    }

    let need_space = (cancelable_by_new_count as usize)
        .checked_mul(PUBKEY_SIZE)
        .unwrap()
        .checked_add(Timelock::DEFAULT_SIZE)
        .unwrap();
    let free_space = timelock_account.space(timelock_account.to_account_info().data_len());
    if free_space.is_none() || free_space.unwrap() < need_space {
        return Err(TokenlockErrors::InsufficientDataSpace.into());
    }

    let decimals = ctx.accounts.mint_address.decimals;
    let from_info = ctx.accounts.from.to_account_info();
    let mint_info = ctx.accounts.mint_address.to_account_info();
    let escrow_account_info = ctx.accounts.escrow_account.to_account_info();
    let authority_info = ctx.accounts.authority.to_account_info();
    invoke_transfer_checked(
        &ctx.accounts.token_program.key,
        from_info,
        mint_info,
        escrow_account_info,
        authority_info,
        ctx.remaining_accounts,
        amount,
        decimals,
        &[],
    )?;

    //add new cancelables
    for i in 0..cancelable_by_indexes.len() {
        if cancelable_by_indexes[i] >= (timelock_account.cancelables.len()) as u8 {
            timelock_account.cancelables.push(cancelable_by[i]);
        }
    }
    sol_memcpy(
        &mut timelock.cancelable_by,
        &cancelable_by_indexes,
        cancelable_by_indexes.len(),
    );

    timelock_account.timelocks.push(timelock);

    Ok(())
}
