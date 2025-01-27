use hyle_sdk::{flatten_blobs, Blob, ContractInput, HyleOutput};
use serde::{Deserialize, Serialize};

use crate::{reclaim::reclaim_process_claim_tweet, ZkvmProcessError};

// TODO: Add CancelBid
#[derive(Serialize, Deserialize)]
pub enum BuyMyTweetAction {
    Claim { input: ContractInput },
    Register { input: ContractInput },
    Buy { input: ContractInput },
}

/* ERRORS */
// TODO: better errors
#[derive(Debug)]
pub enum ContractError {
    NotImplemented,
    InvalidReclaimProof,
    InvalidUser,
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

    pub fn get_user(&self, user_id: &str) -> Option<&BuyMyTweetUser> {
        self.users.get(user_id)
    }

    pub fn get_user_message(&self, user_id: &str, content: &str) -> Option<&BuyMyTweetMessage> {
        self.users
            .get(user_id)
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

    pub fn get_message_by_content(&self, content: &str) -> Option<&BuyMyTweetMessage> {
        self.messages.iter().find(|msg| msg.content == content)
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
        .as_str()
        .expect("should be a str")
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
    })
}

// TODO: Check for Hyllar transfer
fn buy_tweet(input: &ContractInput) -> Result<HyleOutput, ContractError> {
    let mut state: BuyMyTweetState = input.initial_state.clone().into();

    let contract_blob: &Blob = input.blobs.get(input.index.0).expect("could not get index");
    let contract_data: serde_json::Value =
        serde_json::from_slice(&contract_blob.data.0).expect("could not get blob data");

    // does not have to be registered on the state
    let _from = contract_data
        .get("from")
        .expect("invalid JSON file, no from field")
        .as_str()
        .expect("should be a str")
        .to_string();

    let to = contract_data
        .get("to")
        .expect("invalid JSON file, no to field")
        .as_str()
        .expect("should be a str")
        .to_string();

    let content = contract_data
        .get("content")
        .expect("invalid JSON file, no content field")
        .as_str()
        .expect("should be a str")
        .to_string();

    if !state.user_exists(&to) {
        return Err(ContractError::InvalidUser);
    }

    // Get mutable reference to user and add message
    if let Some(user) = state.users.get_mut(&to) {
        let _price = user.get_price();
        // TODO verify that prices matches hyllar blob
        user.add_message(content);
    }
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
    })
}

pub fn execute_contract(action: BuyMyTweetAction) -> Result<HyleOutput, ContractError> {
    match action {
        BuyMyTweetAction::Claim { input } => claim_tweet(&input),
        BuyMyTweetAction::Register { input } => register_user(&input),
        BuyMyTweetAction::Buy { input } => buy_tweet(&input),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_state() -> BuyMyTweetState {
        let mut state = BuyMyTweetState::new();
        state.add_user("alice".to_string(), 100);
        state
    }

    #[test]
    fn test_new_state() {
        let state = BuyMyTweetState::new();
        assert!(state.users.is_empty());
    }

    #[test]
    fn test_add_user() {
        let mut state = BuyMyTweetState::new();
        state.add_user("alice".to_string(), 100);

        assert!(state.user_exists("alice"));
        assert_eq!(state.get_user("alice").unwrap().to_owned().get_price(), 100);
    }

    #[test]
    fn test_user_message_operations() {
        let mut state = setup_test_state();
        let user = state.users.get_mut("alice").unwrap();

        // Test adding message
        user.add_message("Hello, World!".to_string());

        // Test getting message
        let message = user.get_message_by_content("Hello, World!").unwrap();
        assert_eq!(message.content, "Hello, World!");
        assert!(!message.get_status());
    }

    #[test]
    fn test_user_price_operations() {
        let mut state = setup_test_state();
        let user = state.users.get_mut("alice").unwrap();

        assert_eq!(user.get_price(), 100);

        user.update_price(200);
        assert_eq!(user.get_price(), 200);
    }

    #[test]
    fn test_message_status_update() {
        let mut state = setup_test_state();
        let user = state.users.get_mut("alice").unwrap();

        user.add_message("Test message".to_string());
        let message = &mut user.messages[0];

        assert!(!message.get_status());
        message.update_status(true);
        assert!(message.get_status());
    }

    #[test]
    fn test_state_serialization() {
        let mut original_state = BuyMyTweetState::new();
        original_state.add_user("bob".to_string(), 150);

        // Convert to StateDigest
        let state_digest: hyle_sdk::StateDigest = original_state.clone().into();

        // Convert back to BuyMyTweetState
        let recovered_state: BuyMyTweetState = state_digest.into();

        assert!(recovered_state.user_exists("bob"));
        assert_eq!(
            recovered_state
                .get_user("bob")
                .unwrap()
                .to_owned()
                .get_price(),
            150
        );
    }

    #[test]
    fn test_register_user_action() {
        // Create a mock ContractInput
        let initial_state = BuyMyTweetState::new();
        let state_digest = hyle_sdk::StateDigest::from(initial_state);

        let contract_data = serde_json::json!({
            "username": "charlie",
            "price": 300
        });

        let blob = Blob {
            data: hyle_sdk::BlobData(serde_json::to_vec(&contract_data).unwrap()),
            contract_name: "contract".into(),
        };

        let blobs = vec![blob];

        let input = ContractInput {
            initial_state: state_digest,
            identity: hyle_sdk::Identity("".to_string()),
            index: hyle_sdk::BlobIndex(0),
            blobs,
            private_blob: hyle_sdk::BlobData(vec![]),
            tx_hash: hyle_sdk::TxHash("".to_string()),
        };

        let action = BuyMyTweetAction::Register { input };
        let result = execute_contract(action);

        assert!(result.is_ok());
        let output = result.unwrap();
        assert!(output.success);

        // Verify the new state
        let final_state: BuyMyTweetState = output.next_state.into();
        let state_str = serde_json::to_string(&final_state).unwrap();
        eprintln!("final_state: {}", state_str);
        eprintln!("{}", final_state.user_exists("charlie"));

        assert!(final_state.user_exists("charlie"));
        let user = final_state.get_user("charlie").unwrap();
        assert_eq!(user.to_owned().get_price(), 300);
    }

    #[test]
    fn test_register_existing_user() {
        let mut initial_state = BuyMyTweetState::new();
        initial_state.add_user("existing_user".to_string(), 100);
        let state_digest = hyle_sdk::StateDigest::from(initial_state);

        let contract_data = serde_json::json!({
            "username": "existing_user",
            "price": 200
        });

        let blob = Blob {
            data: hyle_sdk::BlobData(serde_json::to_vec(&contract_data).unwrap()),
            contract_name: "contract".into(),
        };

        let blobs = vec![blob];

        let input = ContractInput {
            initial_state: state_digest,
            identity: hyle_sdk::Identity("".to_string()),
            index: hyle_sdk::BlobIndex(0),
            blobs,
            private_blob: hyle_sdk::BlobData(vec![]),
            tx_hash: hyle_sdk::TxHash("".to_string()),
        };

        let action = BuyMyTweetAction::Register { input };
        let result = execute_contract(action);

        assert!(matches!(result, Err(ContractError::UserAlreadyRegistered)));
    }

    #[test]
    fn test_buy_tweet_action() {
        // Setup initial state with a registered user
        let mut initial_state = BuyMyTweetState::new();
        initial_state.add_user("seller".to_string(), 100);
        let state_digest = hyle_sdk::StateDigest::from(initial_state);

        // Create contract data for buying a tweet
        let contract_data = serde_json::json!({
            "from": "buyer",
            "to": "seller",
            "content": "This is a test tweet"
        });

        let blob = Blob {
            data: hyle_sdk::BlobData(serde_json::to_vec(&contract_data).unwrap()),
            contract_name: "contract".into(),
        };

        let blobs = vec![blob];

        let input = ContractInput {
            initial_state: state_digest,
            identity: hyle_sdk::Identity("".to_string()),
            index: hyle_sdk::BlobIndex(0),
            blobs,
            private_blob: hyle_sdk::BlobData(vec![]),
            tx_hash: hyle_sdk::TxHash("".to_string()),
        };

        let action = BuyMyTweetAction::Buy { input };
        let result = execute_contract(action);

        assert!(result.is_ok());
        let output = result.unwrap();
        assert!(output.success);

        let final_state: BuyMyTweetState = output.next_state.into();
        eprintln!(
            "final_state: {}",
            serde_json::to_string(&final_state).unwrap()
        );
        let seller = final_state.get_user("seller").unwrap();
        eprintln!("seller: {}", serde_json::to_string(seller).unwrap());

        // Verify that the message was added to the seller's messages
        let message = seller.get_message_by_content("This is a test tweet");
        assert!(message.is_some());
        assert!(!message.unwrap().get_status());
    }

    #[test]
    fn test_buy_tweet_invalid_user() {
        // Setup initial state with no users
        let initial_state = BuyMyTweetState::new();
        let state_digest = hyle_sdk::StateDigest::from(initial_state);

        // Create contract data for buying a tweet from non-existent user
        let contract_data = serde_json::json!({
            "from": "buyer",
            "to": "nonexistent_seller",
            "content": "This is a test tweet"
        });

        let blob = Blob {
            data: hyle_sdk::BlobData(serde_json::to_vec(&contract_data).unwrap()),
            contract_name: "contract".into(),
        };

        let blobs = vec![blob];

        let input = ContractInput {
            initial_state: state_digest,
            identity: hyle_sdk::Identity("".to_string()),
            index: hyle_sdk::BlobIndex(0),
            blobs,
            private_blob: hyle_sdk::BlobData(vec![]),
            tx_hash: hyle_sdk::TxHash("".to_string()),
        };

        let action = BuyMyTweetAction::Buy { input };
        let result = execute_contract(action);

        // Should fail because seller doesn't exist
        assert!(matches!(result, Err(ContractError::InvalidUser)));
    }
}
