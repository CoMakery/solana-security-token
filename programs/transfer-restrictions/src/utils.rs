use anchor_lang::{
    prelude::Result,
    solana_program::{program::invoke, system_instruction::transfer},
    Lamports,
};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};

use crate::{
    SECURITY_ASSOCIATED_ACCOUNT_PREFIX, TRANSFER_RESTRICTION_DATA_PREFIX,
    TRANSFER_RESTRICTION_GROUP_PREFIX, TRANSFER_RULE_PREFIX,
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
        // [index 8, 3] transfer restriction group from account
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes().to_vec(),
                },
                Seed::AccountKey { index: 5 },
                Seed::AccountData {
                    account_index: 6,
                    data_index: 8,
                    length: 8,
                },
            ],
            false,
            false,
        )?,
        // [index 9, 4] transfer restriction group to account
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: TRANSFER_RESTRICTION_GROUP_PREFIX.as_bytes().to_vec(),
                },
                Seed::AccountKey { index: 5 },
                Seed::AccountData {
                    account_index: 7,
                    data_index: 8,
                    length: 8,
                },
            ],
            false,
            false,
        )?,
        // [index 10, 5] transfer rule account
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: TRANSFER_RULE_PREFIX.as_bytes().to_vec(),
                },
                Seed::AccountKey { index: 8 },
                Seed::AccountKey { index: 9 },
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

