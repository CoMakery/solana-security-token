use anchor_lang::{
    prelude::Result,
    solana_program::{program::invoke, pubkey::Pubkey, system_instruction::transfer},
    Lamports,
};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};

use crate::{
    errors::TransferRestrictionsError, SECURITY_ASSOCIATED_ACCOUNT_PREFIX,
    TRANSFER_RESTRICTION_DATA_PREFIX, TRANSFER_RULE_PREFIX,
};

use crate::{AccountInfo, Rent, SolanaSysvar};

pub fn get_meta_list_size() -> Result<usize> {
    Ok(ExtraAccountMetaList::size_of(get_extra_account_metas()?.len()).unwrap())
}

pub fn get_extra_account_metas() -> Result<Vec<ExtraAccountMeta>> {
    Ok(vec![
        // [index 5, 0] transfer restrictions account
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: TRANSFER_RESTRICTION_DATA_PREFIX.as_bytes().to_vec(),
                },
                Seed::AccountKey { index: 1 },
            ],
            false, // is_signer
            false, // is_writable
        )?,
        // [index 6, 1] security associated account from
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes().to_vec(),
                },
                Seed::AccountKey { index: 0 },
            ],
            false,
            false,
        )?,
        // [index 7, 2] security associated account to
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: SECURITY_ASSOCIATED_ACCOUNT_PREFIX.as_bytes().to_vec(),
                },
                Seed::AccountKey { index: 2 },
            ],
            false,
            false,
        )?,
        // [index 8, 3] transfer rule account
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: TRANSFER_RULE_PREFIX.as_bytes().to_vec(),
                },
                Seed::AccountKey { index: 5 },
                Seed::AccountData {
                    account_index: 6,
                    data_index: 8,
                    length: 8,
                },
                Seed::AccountData {
                    account_index: 7,
                    data_index: 8,
                    length: 8,
                },
            ],
            false,
            false,
        )?,
    ])
}

pub fn update_account_lamports_to_minimum_balance<'info>(
    account: AccountInfo<'info>,
    payer: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
) -> Result<()> {
    let extra_lamports = Rent::get()?.minimum_balance(account.data_len()) - account.get_lamports();
    if extra_lamports > 0 {
        invoke(
            &transfer(payer.key, account.key, extra_lamports),
            &[payer, account, system_program],
        )?;
    }
    Ok(())
}

pub fn verify_pda(address: &Pubkey, seeds: &[&[u8]], program_id: &Pubkey) -> Result<()> {
    let (pda, _bump_seed) = Pubkey::find_program_address(seeds, program_id);
    if pda != *address {
        return Err(TransferRestrictionsError::InvalidPDA.into());
    }
    Ok(())
}
