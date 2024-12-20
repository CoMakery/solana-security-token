use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::spl_token_2022::extension::transfer_fee::TransferFeeConfig,
    token_interface::get_mint_extension_data,
};

use crate::errors::DividendsErrorCode;

pub fn validate_transfer_fee_mint_extension(mint_data: &AccountInfo) -> Result<()> {
    let transfer_fee_extension = get_mint_extension_data::<TransferFeeConfig>(mint_data);
    if let Ok(_extension) = transfer_fee_extension {
        return Err(DividendsErrorCode::TransferFeeIsNotAllowedForPaymentMint.into());
    }

    Ok(())
}
