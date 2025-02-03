use hyle_sdk::{flatten_blobs, Blob, BlobIndex, ContractInput, HyleOutput};
use serde::{Deserialize, Serialize};

use crate::{reclaim::reclaim_process_claim_tweet, ZkvmProcessError};

#[derive(Serialize, Deserialize)]
pub enum BuyMyTweetAction {
    /* commented until fix relcaim
    Claim {
        reclaim_contract_index: u64,
        reclaim_contract_params: String,
    },
    */
    Claim {
        message: String,
        username: String,
    },
    Register {
        username: String,
        price: u64,
    },
    Buy {
        from: String,
        to: String,
        content: String,
    },
}

/* ERRORS */
#[derive(Debug)]
pub enum ContractError {
    NotImplemented,
    InvalidReclaimProof,
    InvalidUser,
    UserAlreadyRegistered,
    InvalidActionData,
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
    pub users: std::collections::HashMap<String, BuyMyTweetUser>,
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

    pub fn get_user(&self, user_id: &str) -> Option<&BuyMyTweetUser> {
        self.users.get(user_id)
    }

    pub fn get_user_message(
        &mut self,
        user_id: &str,
        content: &str,
    ) -> Option<&mut BuyMyTweetMessage> {
        self.users
            .get_mut(user_id)
            .and_then(|user| user.get_message_by_content(content))
    }

    pub fn user_exists(&self, user_id: &str) -> bool {
        eprintln!(
            "users:{}, user_id:{}",
            serde_json::to_string(&self.users).unwrap(),
            user_id
        );
        self.users.contains_key(user_id)
    }
}

impl BuyMyTweetUser {
    pub fn add_message(&mut self, content: String) {
        self.messages.push(BuyMyTweetMessage {
            content,
            status: false,
        });
    }

    pub fn get_price(&mut self) -> u64 {
        self.price
    }

    pub fn update_price(&mut self, new_price: u64) {
        self.price = new_price;
    }

    pub fn get_message_by_content(&mut self, content: &str) -> Option<&mut BuyMyTweetMessage> {
        self.messages.iter_mut().find(|msg| msg.content == content)
    }
}

impl From<hyle_sdk::StateDigest> for BuyMyTweetState {
    fn from(state: hyle_sdk::StateDigest) -> Self {
        if state.0 == Vec::<u8>::new() {
            BuyMyTweetState::default()
        } else {
            serde_json::from_slice(&state.0)
                .map_err(|_| "Could not decode state".to_string())
                .unwrap()
        }
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

fn parse_action(input: &ContractInput) -> Result<BuyMyTweetAction, ContractError> {
    let contract_blob: &Blob = input
        .blobs
        .get(input.index.0)
        .ok_or(ContractError::InvalidActionData)?;

    let contract_data: serde_json::Value = serde_json::from_slice(&contract_blob.data.0)
        .map_err(|_| ContractError::InvalidActionData)?;

    // Parse the action type from the contract data
    let action_type = contract_data
        .get("action_type")
        .and_then(|v| v.as_str())
        .ok_or(ContractError::InvalidActionData)?;

    match action_type {
        "claim" => {
            /* commented until reclaim fix
            let reclaim_contract_index: u64 = contract_data
                .get("reclaim_contract_index")
                .and_then(|v| v.as_u64())
                .ok_or(ContractError::InvalidActionData)?;

            let reclaim_contract_params = contract_data
                .get("reclaim_contract_params")
                .and_then(|v| v.as_str())
                .ok_or(ContractError::InvalidActionData)?
                .to_string();
            */

            let username = contract_data
                .get("username")
                .and_then(|v| v.as_str())
                .ok_or(ContractError::InvalidActionData)?
                .to_string();

            let message = contract_data
                .get("message")
                .and_then(|v| v.as_str())
                .ok_or(ContractError::InvalidActionData)?
                .to_string();

            Ok(BuyMyTweetAction::Claim { username, message })
        }
        "register" => {
            let username = contract_data
                .get("username")
                .and_then(|v| v.as_str())
                .ok_or(ContractError::InvalidActionData)?
                .to_string();

            let price = contract_data
                .get("price")
                .and_then(|v| v.as_u64())
                .ok_or(ContractError::InvalidActionData)?;

            Ok(BuyMyTweetAction::Register { username, price })
        }
        "buy" => {
            let from = contract_data
                .get("from")
                .and_then(|v| v.as_str())
                .ok_or(ContractError::InvalidActionData)?
                .to_string();

            let to = contract_data
                .get("to")
                .and_then(|v| v.as_str())
                .ok_or(ContractError::InvalidActionData)?
                .to_string();

            let content = contract_data
                .get("content")
                .and_then(|v| v.as_str())
                .ok_or(ContractError::InvalidActionData)?
                .to_string();

            Ok(BuyMyTweetAction::Buy { from, to, content })
        }
        _ => Err(ContractError::InvalidActionData),
    }
}

fn claim_tweet(
    action: &BuyMyTweetAction,
    input: &ContractInput,
) -> Result<HyleOutput, ContractError> {
    let mut state: BuyMyTweetState = input.initial_state.clone().into();

    /* commented until fix reclaim
    if let BuyMyTweetAction::Claim {
        reclaim_contract_params: _,
        reclaim_contract_index: _,
    } = action
    {
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
            tx_ctx: None,
            registered_contracts: vec![],
        })
    } else {
        Err(ContractError::InvalidActionData)
    }
    */
    if let BuyMyTweetAction::Claim { username, message } = action {
        eprintln!("claim 1");
        let Some(message) = state.get_user_message(username, message) else {
            return Err(ContractError::InvalidReclaimProof);
        };
        eprintln!("claim 2");

        if message.get_status() {
            return Err(ContractError::InvalidReclaimProof);
        }
        eprintln!("claim 3");
        message.update_status(true);
        eprintln!("claim 4");

        Ok(HyleOutput {
            version: 1,
            initial_state: input.initial_state.clone(),
            next_state: state.into(),
            identity: input.identity.clone(),
            index: input.index,
            blobs: flatten_blobs(&input.blobs),
            success: true,
            program_outputs: vec![],
            tx_hash: input.tx_hash.clone(),
            registered_contracts: vec![],
            tx_ctx: None,
        })
        // todo : also add check hylalr blob
    } else {
        Err(ContractError::InvalidActionData)
    }
}

fn register_user(
    action: &BuyMyTweetAction,
    input: &ContractInput,
) -> Result<HyleOutput, ContractError> {
    eprintln!("register user 1");
    let mut state: BuyMyTweetState = input.initial_state.clone().into();

    eprintln!("register user 2");
    if let BuyMyTweetAction::Register { username, price } = action {
        if state.user_exists(username) {
            return Err(ContractError::UserAlreadyRegistered);
        }

        eprintln!("register user 3");
        state.add_user(username.clone(), *price);

        eprintln!("register user 4");
        Ok(HyleOutput {
            version: 1,
            initial_state: input.initial_state.clone(),
            next_state: state.into(),
            identity: input.identity.clone(),
            index: input.index,
            blobs: flatten_blobs(&input.blobs),
            success: true,
            program_outputs: vec![],
            tx_hash: input.tx_hash.clone(),
            registered_contracts: vec![],
            tx_ctx: None,
        })
    } else {
        Err(ContractError::InvalidActionData)
    }
}

fn buy_tweet(
    action: &BuyMyTweetAction,
    input: &ContractInput,
) -> Result<HyleOutput, ContractError> {
    eprintln!("buy tweet 1");
    let mut state: BuyMyTweetState = input.initial_state.clone().into();

    eprintln!("buy tweet 2");
    if let BuyMyTweetAction::Buy {
        from: _,
        to,
        content,
    } = action
    {
        eprintln!("buy tweet 3");
        if !state.user_exists(to) {
            return Err(ContractError::InvalidUser);
        }

        eprintln!("buy tweet 4");
        // Get mutable reference to user and add message
        if let Some(user) = state.users.get_mut(to) {
            let _price = user.get_price();
            // TODO verify that prices matches hyllar blob
            user.add_message(content.clone());
        }
        eprintln!("buy tweet 5");

        Ok(HyleOutput {
            version: 1,
            initial_state: input.initial_state.clone(),
            next_state: state.into(),
            identity: input.identity.clone(),
            index: input.index.clone(),
            blobs: flatten_blobs(&input.blobs),
            success: true,
            program_outputs: vec![],
            tx_hash: input.tx_hash.clone(),
            registered_contracts: vec![],
            tx_ctx: None,
        })
    } else {
        Err(ContractError::InvalidActionData)
    }
}

pub fn execute_contract(input: &ContractInput) -> Result<HyleOutput, ContractError> {
    eprintln!("parse_action");
    let action = parse_action(input)?;

    eprintln!("match action");
    match action {
        BuyMyTweetAction::Claim { .. } => claim_tweet(&action, input),
        BuyMyTweetAction::Register { .. } => register_user(&action, input),
        BuyMyTweetAction::Buy { .. } => buy_tweet(&action, input),
    }
}
