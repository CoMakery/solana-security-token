use anchor_lang::{prelude::*, Discriminator};
use anchor_spl::token_interface::spl_pod::slice::PodSlice;
// use anchor_spl::token_2022::spl_token_2022::onchain::invoke_transfer_checked;
use anchor_spl::token_2022::spl_token_2022::extension::{transfer_hook, StateWithExtensions};
use anchor_spl::token_2022::spl_token_2022::instruction;
use anchor_spl::token_2022::spl_token_2022::solana_program::entrypoint::ProgramResult;
use anchor_spl::token_2022::spl_token_2022::solana_program::program::invoke_signed;
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};
use solana_program::instruction::Instruction;
use solana_program::program_memory::sol_memcmp;
use spl_tlv_account_resolution::account::ExtraAccountMeta;
use spl_tlv_account_resolution::error::AccountResolutionError;
// use spl_tlv_account_resolution::state::ExtraAccountMetaList;
use spl_transfer_hook_interface::error::TransferHookError;
use spl_transfer_hook_interface::get_extra_account_metas_address;
use spl_type_length_value::state::{TlvState, TlvStateBorrowed};
// use spl_transfer_hook_interface::onchain::add_extra_accounts_for_execute_cpi;
// pub use solana_program::account_info::{next_account_info, AccountInfo};

use crate::{
    transfer_spl_from_escrow, utils, TimelockData, TokenLockData, TokenLockDataWrapper,
    TokenlockErrors, TOKENLOCK_PDA_SEED,
};

#[derive(Accounts)]
pub struct CancelTimelock<'info> {
    /// CHECK: implemented own serialization in order to save compute units
    pub tokenlock_account: AccountInfo<'info>,

    #[account(mut,
        constraint = timelock_account.tokenlock_account == *tokenlock_account.key,
    )]
    pub timelock_account: Account<'info, TimelockData>,

    #[account(mut)]
    pub escrow_account: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: Escrow account authority
    pub pda_account: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut,
        constraint = *target.key == timelock_account.target_account,
    )]
    /// CHECK: System Account which identify target user wallet
    /// with which will be linked timelocks
    pub target: AccountInfo<'info>,

    #[account(mut,
        constraint = *reclaimer.to_account_info().owner == *token_program.key,
    )]
    pub reclaimer: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        constraint = *target_assoc.to_account_info().owner == *token_program.key,
        constraint = reclaimer.mint == target_assoc.mint,
        constraint = target_assoc.owner == *target.key,
        constraint = escrow_account.mint == reclaimer.mint
    )]
    pub target_assoc: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program,
    )]
    pub mint_address: Box<InterfaceAccount<'info, Mint>>,

    pub token_program: Program<'info, Token2022>,
}

struct MemTest {
    data: u64,
    data1: u64,
    data2: u64,
    data3: u64,
    // data4: u64,
    // data5: u64,
    // data6: u64,
    // data7: u64,
}

impl Default for MemTest {
    fn default() -> Self {
        Self {
            data: 0,
            data1: 0,
            data2: 0,
            data3: 0,
            // data4: 0,
            // data5: 0,
            // data6: 0,
            // data7: 0,
        }
    }
}

pub fn cancel_timelock<'info>(
    ctx: Context<'_, '_, '_, 'info, CancelTimelock<'info>>,
    timelock_id: u32,
) -> Result<()> {
    let timelock_account = &mut ctx.accounts.timelock_account;
    let tokenlock_account = &ctx.accounts.tokenlock_account;
    let tokenlock_account_data = tokenlock_account.try_borrow_data()?;
    let discriminator = TokenLockData::discriminator();
    if sol_memcmp(&discriminator, &tokenlock_account_data, discriminator.len()) != 0 {
        return Err(TokenlockErrors::IncorrectTokenlockAccount.into());
    }

    //constraint
    let mint_address = TokenLockDataWrapper::mint_address(&tokenlock_account_data);
    let escrow_account = TokenLockDataWrapper::escrow_account(&tokenlock_account_data);

    if escrow_account != *ctx.accounts.escrow_account.to_account_info().key {
        return Err(TokenlockErrors::MisMatchedEscrow.into());
    }
    if mint_address != ctx.accounts.reclaimer.mint
        || mint_address != ctx.accounts.mint_address.key()
    {
        return Err(TokenlockErrors::MisMatchedToken.into());
    }

    //check param
    if timelock_id >= timelock_account.timelocks.len() as u32 {
        return Err(TokenlockErrors::InvalidTimelockId.into());
    }

    let cancelable_by_index = timelock_account.get_cancelable_index(ctx.accounts.authority.key);
    if cancelable_by_index.is_none() {
        return Err(TokenlockErrors::HasntCancelTimelockPermission.into());
    }
    let timelock = timelock_account.get_timelock(timelock_id).unwrap();
    if timelock.has_cancelable_by(cancelable_by_index.unwrap()) == false {
        return Err(TokenlockErrors::HasntCancelTimelockPermission.into());
    }

    let now_ts = utils::get_unix_timestamp();
    let paid_amount =
        timelock_account.unlocked_balance_of_timelock(timelock_id, &tokenlock_account_data, now_ts);
    let canceled_amount =
        timelock_account.locked_balance_of_timelock(timelock_id, &tokenlock_account_data, now_ts);
    if canceled_amount as u64 == 0 {
        return Err(TokenlockErrors::TimelockHasntValue.into());
    }

    let split_at_pos = ctx.remaining_accounts.len() / 2;
    msg!("split_at_pos: {}", split_at_pos);
    let bump_seed = &[TokenLockDataWrapper::bump_seed(&tokenlock_account_data)];
    let seeds = [
        TOKENLOCK_PDA_SEED.as_ref(),
        mint_address.as_ref(),
        tokenlock_account.key.as_ref(),
        bump_seed,
    ];

    let seeds_slice: &[&[u8]] = &seeds;

    invoke_transfer_checked(
        ctx.accounts.token_program.key,
        ctx.accounts.escrow_account.to_account_info().clone(),
        ctx.accounts.mint_address.to_account_info().clone(),
        ctx.accounts.reclaimer.to_account_info(),
        ctx.accounts.pda_account.clone(),
        &ctx.remaining_accounts[..split_at_pos],
        canceled_amount,
        ctx.accounts.mint_address.decimals,
        &[seeds_slice],
    )?;

    invoke_transfer_checked(
        ctx.accounts.token_program.key,
        ctx.accounts.escrow_account.to_account_info().clone(),
        ctx.accounts.mint_address.to_account_info(),
        ctx.accounts.target_assoc.to_account_info(),
        ctx.accounts.pda_account.clone(),
        &ctx.remaining_accounts[split_at_pos..],
        paid_amount,
        ctx.accounts.mint_address.decimals,
        &[seeds_slice],
    )?;
    // test_heap_size()?;

    let timelock1 = timelock_account.get_timelock_mut(timelock_id).unwrap();
    timelock1.tokens_transferred = timelock1.total_amount;

    Ok(())
}

fn test_heap_size() -> Result<()> {
    msg!("Going to test stack and heap memory size");
    // let mut stack_var: [u8; 1_000_000] = [99; 1_000_000];
    let mut heap_data: Box<[u8; 11_699]> = Box::new([0; 11_699]); // 11_690 ok, 11_699 failed
    let mut heap_data_2: Box<[u8; 16_159]> = Box::new([0; 16_159]); // 16_158 ok, 16_159 failed
    heap_data[0] = 1;
    heap_data[1] = 1;
    heap_data[3] = 3;
    heap_data[10333] = 3;
    heap_data_2[10333] = 3;
    msg!("heap_data_2.len() = {} [] {}", heap_data_2.len(), std::mem::size_of_val(&heap_data_2));
    msg!("Going to test stack and heap memory size 1");
    msg!("heap_data.len() = {} ({}) = {}", heap_data.len(), std::mem::size_of::<[u8; 10_000]>(), std::mem::size_of_val(&heap_data));

    return Err(TokenlockErrors::HasntCancelTimelockPermission.into());
}

/// Helper to CPI into token-2022 on-chain, looking through the additional
/// account infos to create the proper instruction with the proper account infos
#[allow(clippy::too_many_arguments)]
pub fn invoke_transfer_checked<'a>(
    token_program_id: &Pubkey,
    source_info: AccountInfo<'a>,
    mint_info: AccountInfo<'a>,
    destination_info: AccountInfo<'a>,
    authority_info: AccountInfo<'a>,
    additional_accounts: &[AccountInfo<'a>],
    amount: u64,
    decimals: u8,
    seeds: &[&[&[u8]]],
) -> ProgramResult {
    let mut cpi_instruction = instruction::transfer_checked(
        token_program_id,
        source_info.key,
        mint_info.key,
        destination_info.key,
        authority_info.key,
        &[], // add them later, to avoid unnecessary clones
        amount,
        decimals,
    )?;

    let mut cpi_account_infos = vec![
        source_info.clone(),
        mint_info.clone(),
        destination_info.clone(),
        authority_info.clone(),
    ];

    // if it's a signer, it might be a multisig signer, throw it in!
    additional_accounts
        .iter()
        .filter(|ai| ai.is_signer)
        .for_each(|ai| {
            cpi_account_infos.push(ai.clone());
            cpi_instruction
                .accounts
                .push(AccountMeta::new_readonly(*ai.key, ai.is_signer));
        });
    msg!("====!! Going to add extra accounts !!====");
    // scope the borrowing to avoid a double-borrow during CPI
    {
        let mint_data = mint_info.try_borrow_data()?;
        let mint =
            StateWithExtensions::<anchor_spl::token_2022::spl_token_2022::state::Mint>::unpack(
                &mint_data,
            )?;
        if let Some(program_id) = transfer_hook::get_program_id(&mint) {
            add_extra_accounts_for_execute_cpi(
                &mut cpi_instruction,
                &mut cpi_account_infos,
                &program_id,
                source_info,
                mint_info.clone(),
                destination_info,
                authority_info,
                amount,
                additional_accounts,
            )?;
        }
    }
    msg!("====!! Going to invoke_signed !!====");

    invoke_signed(&cpi_instruction, &cpi_account_infos, seeds)
}

#[allow(clippy::too_many_arguments)]
pub fn add_extra_accounts_for_execute_cpi<'a>(
    cpi_instruction: &mut Instruction,
    cpi_account_infos: &mut Vec<AccountInfo<'a>>,
    program_id: &Pubkey,
    source_info: AccountInfo<'a>,
    mint_info: AccountInfo<'a>,
    destination_info: AccountInfo<'a>,
    authority_info: AccountInfo<'a>,
    amount: u64,
    additional_accounts: &[AccountInfo<'a>],
) -> ProgramResult {
    msg!("\t====!! Inside add_extra_accounts_for_execute_cpi !!====");
    let validate_state_pubkey = get_extra_account_metas_address(mint_info.key, program_id);
    let validate_state_info = additional_accounts
        .iter()
        .find(|&x| *x.key == validate_state_pubkey)
        .ok_or(TransferHookError::IncorrectAccount)?;

    let program_info = additional_accounts
        .iter()
        .find(|&x| x.key == program_id)
        .ok_or(TransferHookError::IncorrectAccount)?;

    let mut execute_instruction = spl_transfer_hook_interface::instruction::execute(
        program_id,
        source_info.key,
        mint_info.key,
        destination_info.key,
        authority_info.key,
        &validate_state_pubkey,
        amount,
    );
    let mut execute_account_infos = vec![
        source_info,
        mint_info,
        destination_info,
        authority_info,
        validate_state_info.clone(),
    ];

    msg!("\t====!! ExtraAccountMetaList::add_to_cpi_instruction !!====");
    // NOTE: Replaces sdk function with the same name custom implementation (now same impl as in SDK)
    // ExtraAccountMetaList::add_to_cpi_instruction::<spl_transfer_hook_interface::instruction::ExecuteInstruction>(
    add_to_cpi_instruction(
        &mut execute_instruction,
        &mut execute_account_infos,
        &validate_state_info.try_borrow_data()?,
        additional_accounts,
    )?;

    msg!("====!! Adding accounts from execute_instruction !!====");
    // Add only the extra accounts resolved from the validation state
    cpi_instruction
        .accounts
        .extend_from_slice(&execute_instruction.accounts[5..]);
    cpi_account_infos.extend_from_slice(&execute_account_infos[5..]);

    // Add the program id and validation state account
    msg!("\t====!! Adding program_id and validate_state_pubkey !!====");
    cpi_instruction
        .accounts
        .push(AccountMeta::new_readonly(*program_id, false));
    cpi_instruction
        .accounts
        .push(AccountMeta::new_readonly(validate_state_pubkey, false));
    cpi_account_infos.push(program_info.clone());
    cpi_account_infos.push(validate_state_info.clone());

    Ok(())
}

/// Add the additional account metas and account infos for a CPI
pub fn add_to_cpi_instruction<'a>(
    cpi_instruction: &mut Instruction,
    cpi_account_infos: &mut Vec<AccountInfo<'a>>,
    data: &[u8],
    account_infos: &[AccountInfo<'a>],
) -> std::result::Result<(), ProgramError> {
    msg!("??? inside ::add_to_cpi_instruction !!====");
     let state = TlvStateBorrowed::unpack(data)?;
    let bytes =
        state.get_first_bytes::<spl_transfer_hook_interface::instruction::ExecuteInstruction>()?;
    let extra_account_metas = PodSlice::<ExtraAccountMeta>::unpack(bytes)?;

    msg!("extra_account_metas.data() = {}", extra_account_metas.data().len());
    for extra_meta in extra_account_metas.data().iter() {
        let mut meta = {
            // Create a list of `Ref`s so we can reference account data in the
            // resolution step
            let account_key_data_refs = cpi_account_infos
                .iter()
                .map(|info| {
                    let key = *info.key;
                    let data = info.try_borrow_data()?;
                    Ok((key, data))
                })
                .collect::<std::result::Result<Vec<_>, ProgramError>>()?;

            extra_meta.resolve(
                &cpi_instruction.data,
                &cpi_instruction.program_id,
                |usize| {
                    account_key_data_refs
                        .get(usize)
                        .map(|(pubkey, opt_data)| (pubkey, Some(opt_data.as_ref())))
                },
            )?
        };
        msg!("de_escalate_account_meta");
        de_escalate_account_meta(&mut meta, &cpi_instruction.accounts);

        let account_info = account_infos
            .iter()
            .find(|&x| *x.key == meta.pubkey)
            .ok_or(AccountResolutionError::IncorrectAccount)?
            .clone();

        msg!("====>>> [going to push meta to cpi_instruction.accounts and account_info to cpi_account_infos]");
        cpi_instruction.accounts.push(meta);
        cpi_account_infos.push(account_info);
    }
    Ok(())
}

/// De-escalate an account meta if necessary
fn de_escalate_account_meta(account_meta: &mut AccountMeta, account_metas: &[AccountMeta]) {
    // This is a little tricky to read, but the idea is to see if
    // this account is marked as writable or signer anywhere in
    // the instruction at the start. If so, DON'T escalate it to
    // be a writer or signer in the CPI
    let maybe_highest_privileges = account_metas
        .iter()
        .filter(|&x| x.pubkey == account_meta.pubkey)
        .map(|x| (x.is_signer, x.is_writable))
        .reduce(|acc, x| (acc.0 || x.0, acc.1 || x.1));
    // If `Some`, then the account was found somewhere in the instruction
    if let Some((is_signer, is_writable)) = maybe_highest_privileges {
        if !is_signer && is_signer != account_meta.is_signer {
            // Existing account is *NOT* a signer already, but the CPI
            // wants it to be, so de-escalate to not be a signer
            account_meta.is_signer = false;
        }
        if !is_writable && is_writable != account_meta.is_writable {
            // Existing account is *NOT* writable already, but the CPI
            // wants it to be, so de-escalate to not be writable
            account_meta.is_writable = false;
        }
    }
}
