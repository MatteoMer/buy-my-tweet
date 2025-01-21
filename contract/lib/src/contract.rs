use hyle_sdk::{flatten_blobs, Blob, ContractInput, HyleOutput};
use serde::{Deserialize, Serialize};

use crate::{reclaim::reclaim_process_claim_tweet, ZkvmProcessError};

#[derive(Serialize, Deserialize)]
pub enum BuyMyTweetAction {
    Claim { input: ContractInput },
    Register { input: ContractInput },
    Buy { input: ContractInput },
}

/* ERRORS */
// TODO: better errors
pub enum ContractError {
    NotImplemented,
    InvalidReclaimProof,
    UserAlreadyRegistered,
}

impl From<ZkvmProcessError> for ContractError {
    fn from(_value: ZkvmProcessError) -> Self {
        Self::NotImplemented
    }
}

impl From<ContractError> for ZkvmProcessError {
    fn from(_value: ContractError) -> Self {
        Self::ContractError
    }
}

/* STATE */
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BuyMyTweetMessage {
    content: String,
    status: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BuyMyTweetUser {
    id: String,
    price: u64,
    messages: Vec<BuyMyTweetMessage>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BuyMyTweetState {
    #[serde(default)]
    users: std::collections::HashMap<String, BuyMyTweetUser>,
}

impl BuyMyTweetMessage {
    pub fn get_status(&self) -> bool {
        self.status
    }

    pub fn update_status(&mut self, status: bool) {
        self.status = status;
    }
}

impl BuyMyTweetState {
    pub fn new() -> Self {
        Self {
            users: std::collections::HashMap::new(),
        }
    }

    pub fn add_user(&mut self, id: String, price: u64) {
        let user = BuyMyTweetUser {
            id: id.clone(),
            price,
            messages: Vec::new(),
        };
        self.users.insert(id, user);
    }

    pub fn get_user_message(&self, user_id: &str, content: &str) -> Option<&BuyMyTweetMessage> {
        self.users
            .get(user_id)
            .and_then(|user| user.get_message_by_content(content))
    }

    pub fn user_exists(&self, user_id: &str) -> bool {
        self.users.get(user_id).is_some()
    }
}

impl BuyMyTweetUser {
    pub fn add_message(&mut self, content: String) {
        self.messages.push(BuyMyTweetMessage {
            content,
            status: false,
        });
    }

    pub fn update_price(&mut self, new_price: u64) {
        self.price = new_price;
    }

    pub fn get_message_by_content(&self, content: &str) -> Option<&BuyMyTweetMessage> {
        self.messages.iter().find(|msg| msg.content == content)
    }
}

impl From<hyle_sdk::StateDigest> for BuyMyTweetState {
    fn from(state: hyle_sdk::StateDigest) -> Self {
        serde_json::from_slice(&state.0)
            .map_err(|_| "Could not decode state".to_string())
            .unwrap()
    }
}

impl From<BuyMyTweetState> for hyle_sdk::StateDigest {
    fn from(state: BuyMyTweetState) -> Self {
        Self(
            serde_json::to_vec(&state)
                .map_err(|_| "Could not encode state".to_string())
                .unwrap(),
        )
    }
}

fn claim_tweet(input: &ContractInput) -> Result<HyleOutput, ContractError> {
    let mut state: BuyMyTweetState = input.initial_state.clone().into();

    reclaim_process_claim_tweet(input, &mut state).map(|_| HyleOutput {
        version: 1,
        initial_state: input.initial_state.clone(),
        next_state: state.into(),
        identity: input.identity.clone(),
        index: input.index.clone(),
        blobs: flatten_blobs(&input.blobs),
        success: true,
        program_outputs: vec![],
        tx_hash: input.tx_hash.clone(),
    })
}

// TODO: maybe add other reclaim proof?
fn register_user(input: &ContractInput) -> Result<HyleOutput, ContractError> {
    let mut state: BuyMyTweetState = input.initial_state.clone().into();

    let contract_blob: &Blob = input.blobs.get(input.index.0).expect("could not get index");
    let contract_data: serde_json::Value =
        serde_json::from_slice(&contract_blob.data.0).expect("could not get blob data");

    let username = contract_data
        .get("username")
        .expect("invalid JSON file, no username field")
        .to_string();
    let price: u64 = contract_data
        .get("price")
        .expect("invalid JSON file, no price field")
        .as_u64()
        .expect("invalid price field");

    if state.user_exists(&username) {
        return Err(ContractError::UserAlreadyRegistered);
    }

    state.add_user(username, price);

    reclaim_process_claim_tweet(input, &mut state).map(|_| HyleOutput {
        version: 1,
        initial_state: input.initial_state.clone(),
        next_state: state.into(),
        identity: input.identity.clone(),
        index: input.index.clone(),
        blobs: flatten_blobs(&input.blobs),
        success: true,
        program_outputs: vec![],
        tx_hash: input.tx_hash.clone(),
    })
}
pub fn execute_contract(action: BuyMyTweetAction) -> Result<HyleOutput, ContractError> {
    match action {
        BuyMyTweetAction::Claim { input } => claim_tweet(&input),
        BuyMyTweetAction::Register { input } => register_user(&input),
        _ => Err(ContractError::NotImplemented),
    }
}
