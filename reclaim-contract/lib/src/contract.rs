use hyle_sdk::{flatten_blobs, ContractInput, HyleOutput};

use crate::reclaim::process_reclaim_input;

pub enum BuyMyTweetAction<'a> {
    Claim { input: &'a ContractInput },
    Register { input: &'a ContractInput },
    Buy { input: &'a ContractInput },
}

pub enum ContractError {
    NotImplemented,
}

fn claim_tweet(input: &ContractInput) -> Result<HyleOutput, ContractError> {
    let is_valid = process_reclaim_input(&input);
    Ok(HyleOutput {
        version: 1,
        initial_state: input.initial_state.clone(),
        next_state: input.initial_state.clone(),
        identity: input.identity.clone(),
        index: input.index.clone(),
        blobs: flatten_blobs(&input.blobs),
        success: is_valid?,
        program_outputs: vec![],
        tx_hash: input.tx_hash.clone(),
    })
}

pub fn execute_contract(action: BuyMyTweetAction) -> Result<HyleOutput, ContractError> {
    match action {
        BuyMyTweetAction::Claim { input } => claim_tweet(&input),
        _ => Err(ContractError::NotImplemented),
    }
}
