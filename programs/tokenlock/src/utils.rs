use anchor_lang::prelude::*;
use anchor_spl::token::Transfer;
use sha2::{Digest, Sha256};
extern crate hex;
use anchor_lang::solana_program::program_memory::sol_memcpy;
#[cfg(not(target_os = "solana"))]
use std::time::{SystemTime, UNIX_EPOCH};

pub const TOKENLOCK_PDA_SEED: &[u8] = b"tokenlock";

pub fn transfer_spl<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    let cpi_accounts = Transfer {
        from: from.clone(),
        to: to.clone(),
        authority: authority.clone(),
    };
    let cpi_ctx = CpiContext::new(token_program.clone(), cpi_accounts);

    anchor_spl::token::transfer(cpi_ctx, amount)?;

    Ok(())
}

pub fn transfer_spl_from_escrow<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    amount: u64,
    mint_address: &Pubkey,
    tokenlock_account: &Pubkey,
    bump_seed: u8,
) -> Result<()> {
    let cpi_accounts = Transfer {
        from: from.clone(),
        to: to.clone(),
        authority: authority.clone(),
    };

    let cpi_ctx = CpiContext::new(token_program.clone(), cpi_accounts);
    let seeds = &[
        &TOKENLOCK_PDA_SEED[..],
        &mint_address.as_ref()[..],
        &tokenlock_account.as_ref()[..],
        &[bump_seed],
    ];
    anchor_spl::token::transfer(cpi_ctx.with_signer(&[&seeds[..]]), amount)?;

    Ok(())
}

pub fn calc_signer_hash(key: &Pubkey, bump: [u8; 16]) -> [u8; 20] {
    let data = [&key.as_ref()[..], &bump].concat();

    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut res: [u8; 20] = [0; 20];
    sol_memcpy(&mut res, &result[0..20], 20);

    return res;
}

// in order to support unittest scenarion and solana prod
// we need to define implementation regarding architecture
// bpf - solana sealevel
pub fn get_unix_timestamp() -> u64 {
    // #[cfg(target_arch = "bpf")]
    #[cfg(target_os = "solana")]
    {
        let now_ts = Clock::get().expect("Time error").unix_timestamp as u64;
        return now_ts;
    }

    #[cfg(not(target_os = "solana"))]
    {
        let start = SystemTime::now();
        let since_the_epoch = start.duration_since(UNIX_EPOCH).expect("Time error");
        return since_the_epoch.as_secs();
    }
}

#[cfg(test)]
mod test {
    use {super::*, solana_program::pubkey::Pubkey, std::str::FromStr};

    static TEST_SOLANA_ACCOUNT: &str = "G6quj6Xdzgd6KURYWhxJxfB7TDWLUdCGLCeiVJrGT9vR";

    #[test]
    fn singer_hash_for_zero_nonce() {
        let key = Pubkey::from_str(TEST_SOLANA_ACCOUNT).unwrap();
        let bump: [u8; 16] = [0; 16];

        let result = calc_signer_hash(&key, bump);

        assert_eq!(
            result,
            [
                255, 106, 152, 202, 209, 154, 215, 13, 87, 90, 148, 51, 113, 141, 3, 157, 83, 108,
                9, 207
            ]
        )
    }

    #[test]
    fn singer_hash_for_ff_nonce() {
        let key = Pubkey::from_str(TEST_SOLANA_ACCOUNT).unwrap();
        let bump: [u8; 16] = [255; 16];

        let result = calc_signer_hash(&key, bump);

        assert_eq!(
            result,
            [
                213, 233, 101, 251, 234, 207, 180, 62, 251, 193, 122, 140, 81, 59, 64, 241, 239,
                244, 169, 238
            ]
        )
    }
}