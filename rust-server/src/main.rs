use actix_web::{web, App, HttpResponse, HttpServer, Result};
use client_sdk::{
    helpers::risc0::Risc0Prover,
    rest_client::{IndexerApiHttpClient, NodeApiHttpClient},
    transaction_builder::{ProofTxBuilder, ProvableBlobTx, TxExecutorBuilder},
};
use hyle_sdk::{
    api::APIRegisterContract, Blob, BlobData, BlobIndex, BlobTransaction, ContractInput,
    ContractName, Digestable, Hashable, Identity, ProofData, ProofTransaction, StateDigest, TxHash,
    Verifier,
};
use hyllar::client::metadata::HYLLAR_ELF;
use reqwest::{Client, Url};
use risc0_zkvm::compute_image_id;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{env, sync::Arc};

use methods::{METHOD_ELF, METHOD_ID};
use methods_identity::GUEST_ELF as ID_ELF;
use methods_token::GUEST_ELF as TOKEN_ELF;

use lib::contract::{BuyMyTweetState, BuyMyTweetUser};

#[derive(Debug, Serialize, Deserialize)]
struct BlobResponse {
    tx_hash: String,
    success: bool,
}

type WebNodeClient = web::Data<Arc<NodeApiHttpClient>>;
type IndexerClient = web::Data<Arc<IndexerApiHttpClient>>;

async fn get_proof_data(
    tx: &BlobTransaction,
    tx_hash: String,
    indexer_client: &IndexerClient,
    elf: &[u8],
    contract_name: ContractName,
    index: BlobIndex,
) -> Result<ProofData> {
    // prove simple-identity

    println!("[rust-server] proving {}", contract_name);
    let prover = Risc0Prover::new(elf);
    let state: StateDigest = indexer_client
        .fetch_current_state(&contract_name)
        .await
        .unwrap();

    let contract_input = ContractInput {
        initial_state: state,
        identity: tx.identity.clone(),
        index,
        blobs: tx.blobs.clone(),
        tx_hash: TxHash(tx_hash),
        private_input: vec![],
        tx_ctx: None,
    };

    Ok(prover.prove(contract_input).await.unwrap())
}

#[derive(Debug, Serialize, Deserialize)]
struct ClaimRequest {
    username: String,
    message: String,
    nonce: u32,
}

async fn get_blob_tx_claim(
    input: &web::Json<ClaimRequest>,
    identity: &Identity,
) -> Result<BlobTransaction> {
    let action = hyle_sdk::identity_provider::IdentityAction::VerifyIdentity {
        account: identity.to_string(),
        nonce: input.nonce,
    };
    println!("nonce: {}", input.nonce);
    Ok(BlobTransaction {
        identity: Identity(input.username.clone()),
        blobs: vec![
            Blob {
                contract_name: hyle_sdk::ContractName("simple-identity".to_string()),
                data: hyle_sdk::BlobData(
                    bincode::encode_to_vec(action, bincode::config::standard())
                        .expect("failed to encode BlobData"),
                ),
            },
            Blob {
                contract_name: hyle_sdk::ContractName("buy-my-tweet".to_string()),
                data: hyle_sdk::BlobData(
                    serde_json::to_string(&json!({
                        "action_type": "claim",
                        "username": input.username,
                        "message": input.message
                    }))
                    .unwrap()
                    .as_bytes()
                    .to_vec(),
                ),
            },
        ],
    })
}

async fn claim(
    input: web::Json<ClaimRequest>,
    client: WebNodeClient,
    indexer_client: IndexerClient,
) -> Result<HttpResponse> {
    println!("claiming {}:{}", input.username, input.message);
    let blob_tx = get_blob_tx_claim(&input, &Identity(input.username.clone()))
        .await
        .unwrap();

    // Send the blob transaction using the node client
    let tx_hash = client
        .get_ref()
        .as_ref()
        .send_tx_blob(&blob_tx)
        .await
        .map_err(|e| {
            actix_web::error::ErrorInternalServerError(format!(
                "Failed to send blob transaction: {}",
                e
            ))
        })?;

    let simple_identity_proof_data = get_proof_data(
        &blob_tx,
        tx_hash.to_string(),
        &indexer_client,
        ID_ELF,
        "simple-identity".into(),
        0.into(),
    )
    .await
    .unwrap();

    eprintln!("sending tx proof simple-identity");
    client
        .send_tx_proof(&ProofTransaction {
            contract_name: "simple-identity".into(),
            proof: simple_identity_proof_data,
        })
        .await
        .unwrap();

    let contract_proof_data = get_proof_data(
        &blob_tx,
        tx_hash.to_string(),
        &indexer_client,
        METHOD_ELF,
        "buy-my-tweet".into(),
        1.into(),
    )
    .await
    .unwrap();

    eprintln!("sending tx proof buy-my-tweet");
    client
        .send_tx_proof(&ProofTransaction {
            contract_name: "buy-my-tweet".into(),
            proof: contract_proof_data,
        })
        .await
        .unwrap();

    Ok(HttpResponse::Ok().json(BlobResponse {
        tx_hash: tx_hash.to_string(),
        success: true,
    }))
}

#[derive(Debug, Serialize, Deserialize)]
struct RegisterRequest {
    contract_name: String,
    username: String,
    price: u128,
}

async fn get_blob_tx_register(
    input: &web::Json<RegisterRequest>,
    identity: &Identity,
) -> Result<BlobTransaction> {
    let action = hyle_sdk::identity_provider::IdentityAction::RegisterIdentity {
        account: identity.to_string(),
    };
    Ok(BlobTransaction {
        identity: Identity(input.username.clone()),
        blobs: vec![
            Blob {
                contract_name: hyle_sdk::ContractName("simple-identity".to_string()),
                data: hyle_sdk::BlobData(
                    bincode::encode_to_vec(action, bincode::config::standard())
                        .expect("failed to encode BlobData"),
                ),
            },
            Blob {
                contract_name: hyle_sdk::ContractName("buy-my-tweet".to_string()),
                data: hyle_sdk::BlobData(
                    serde_json::to_string(&json!({
                        "action_type": "register",
                        "username": input.username,
                        "price": input.price
                    }))
                    .unwrap()
                    .as_bytes()
                    .to_vec(),
                ),
            },
        ],
    })
}

async fn register(
    input: web::Json<RegisterRequest>,
    client: WebNodeClient,
    indexer_client: IndexerClient,
) -> Result<HttpResponse> {
    println!("registering {}:{}", input.username, input.price);
    let blob_tx = get_blob_tx_register(&input, &Identity(input.username.clone()))
        .await
        .unwrap();

    // Send the blob transaction using the node client
    let tx_hash = client
        .get_ref()
        .as_ref()
        .send_tx_blob(&blob_tx)
        .await
        .map_err(|e| {
            actix_web::error::ErrorInternalServerError(format!(
                "Failed to send blob transaction: {}",
                e
            ))
        })?;

    let simple_identity_proof_data = get_proof_data(
        &blob_tx,
        tx_hash.to_string(),
        &indexer_client,
        ID_ELF,
        "simple-identity".into(),
        0.into(),
    )
    .await
    .unwrap();

    eprintln!("sending tx proof simple-identity");
    client
        .send_tx_proof(&ProofTransaction {
            contract_name: "simple-identity".into(),
            proof: simple_identity_proof_data,
        })
        .await
        .unwrap();

    let contract_proof_data = get_proof_data(
        &blob_tx,
        tx_hash.to_string(),
        &indexer_client,
        METHOD_ELF,
        "buy-my-tweet".into(),
        1.into(),
    )
    .await
    .unwrap();

    eprintln!("sending tx proof buy-my-tweet");
    client
        .send_tx_proof(&ProofTransaction {
            contract_name: "buy-my-tweet".into(),
            proof: contract_proof_data,
        })
        .await
        .unwrap();

    Ok(HttpResponse::Ok().json(BlobResponse {
        tx_hash: tx_hash.to_string(),
        success: true,
    }))
}

#[derive(Debug, Serialize, Deserialize)]
struct RegisterContractRequest {
    contract_name: String,
}

async fn register_contract(
    input: web::Json<RegisterContractRequest>,
    client: WebNodeClient,
) -> Result<HttpResponse> {
    let image_id = hex::encode(compute_image_id(METHOD_ELF).unwrap());

    let tx = APIRegisterContract {
        verifier: Verifier("risc0".to_string()),
        program_id: hyle_sdk::ProgramId(hex::decode(image_id).unwrap()),
        contract_name: "buy-my-tweet".into(),
        state_digest: StateDigest(vec![]),
    };
    client.register_contract(&tx).await.unwrap();

    let image_id = hex::encode(compute_image_id(ID_ELF).unwrap());
    let tx = APIRegisterContract {
        verifier: Verifier("risc0".to_string()),
        program_id: hyle_sdk::ProgramId(hex::decode(image_id).unwrap()),
        contract_name: "simple-identity".into(),
        state_digest: StateDigest(vec![]),
    };
    client.register_contract(&tx).await.unwrap();

    let image_id = hex::encode(compute_image_id(TOKEN_ELF).unwrap());
    let tx = APIRegisterContract {
        verifier: Verifier("risc0".to_string()),
        program_id: hyle_sdk::ProgramId(hex::decode(image_id).unwrap()),
        contract_name: "simple-token".into(),
        state_digest: contract_token::TokenContractState::new(
            100000,
            "faucet.simple-identity".to_string(),
        )
        .as_digest(),
    };

    client.register_contract(&tx).await.unwrap();

    Ok(HttpResponse::Ok().json("ok"))
}

#[derive(Debug, Serialize, Deserialize)]
struct TransferRequest {
    to: String,
    from: String,
    amount: u128,
    nonce: u32,
}
async fn get_blob_tx_transfer(
    input: &web::Json<TransferRequest>,
    identity: &Identity,
) -> Result<BlobTransaction> {
    let id_action = hyle_sdk::identity_provider::IdentityAction::VerifyIdentity {
        account: identity.to_string(),
        nonce: input.nonce,
    };
    let token_action = hyle_sdk::erc20::ERC20Action::Transfer {
        recipient: input.to.clone(),
        amount: input.amount,
    };

    Ok(BlobTransaction {
        identity: identity.clone(),
        blobs: vec![
            Blob {
                contract_name: hyle_sdk::ContractName("simple-identity".to_string()),
                data: hyle_sdk::BlobData(
                    bincode::encode_to_vec(id_action, bincode::config::standard())
                        .expect("failed to encode BlobData"),
                ),
            },
            Blob {
                contract_name: hyle_sdk::ContractName("simple-token".to_string()),
                data: BlobData(
                    bincode::encode_to_vec(token_action, bincode::config::standard())
                        .expect("failed to encode BlobData"),
                ),
            },
        ],
    })
}
async fn transfer(
    input: web::Json<TransferRequest>,
    client: WebNodeClient,
    indexer_client: IndexerClient,
) -> Result<HttpResponse> {
    let identity: Identity = input.from.clone().into();
    let blob_tx = get_blob_tx_transfer(&input, &identity).await.unwrap();

    let tx_hash = client
        .get_ref()
        .as_ref()
        .send_tx_blob(&blob_tx)
        .await
        .map_err(|e| {
            actix_web::error::ErrorInternalServerError(format!(
                "Failed to send blob transaction: {}",
                e
            ))
        })?;

    let simple_identity_proof_data = get_proof_data(
        &blob_tx,
        tx_hash.to_string(),
        &indexer_client,
        ID_ELF,
        "simple-identity".into(),
        0.into(),
    )
    .await
    .unwrap();
    eprintln!("sending tx proof simple-identity");
    client
        .send_tx_proof(&ProofTransaction {
            contract_name: "simple-identity".into(),
            proof: simple_identity_proof_data,
        })
        .await
        .unwrap();

    let token_proof_data = get_proof_data(
        &blob_tx,
        tx_hash.to_string(),
        &indexer_client,
        TOKEN_ELF,
        "simple-token".into(),
        1.into(),
    )
    .await
    .unwrap();

    eprintln!("sending tx proof simple-token");
    client
        .send_tx_proof(&ProofTransaction {
            contract_name: "simple-token".into(),
            proof: token_proof_data,
        })
        .await
        .unwrap();

    Ok(HttpResponse::Ok().json("ok"))
}

#[derive(Debug, Serialize, Deserialize)]
struct BuyRequest {
    user: String,
    amount: u128,
    message: String,
    receiver: String,
    nonce: u32,
}

async fn get_blob_tx_buy(
    input: &web::Json<BuyRequest>,
    identity: &Identity,
) -> Result<BlobTransaction> {
    let id_action = hyle_sdk::identity_provider::IdentityAction::VerifyIdentity {
        account: identity.to_string(),
        nonce: input.nonce,
    };

    println!("nonce: {}", input.nonce);
    let token_action = hyle_sdk::erc20::ERC20Action::Transfer {
        recipient: "faucet.simple-identity".to_string(),
        amount: input.amount,
    };
    Ok(BlobTransaction {
        identity: Identity(input.user.clone()),
        blobs: vec![
            Blob {
                contract_name: hyle_sdk::ContractName("simple-identity".to_string()),
                data: hyle_sdk::BlobData(
                    bincode::encode_to_vec(id_action, bincode::config::standard())
                        .expect("failed to encode BlobData"),
                ),
            },
            Blob {
                contract_name: hyle_sdk::ContractName("buy-my-tweet".to_string()),
                data: hyle_sdk::BlobData(
                    serde_json::to_string(&json!({
                        "action_type": "buy",
                        "from": identity.to_string(),
                        "to": input.receiver,
                        "content": input.message,

                    }))
                    .unwrap()
                    .as_bytes()
                    .to_vec(),
                ),
            },
            Blob {
                contract_name: hyle_sdk::ContractName("simple-token".to_string()),
                data: BlobData(
                    bincode::encode_to_vec(token_action, bincode::config::standard())
                        .expect("failed to encode BlobData"),
                ),
            },
        ],
    })
}

async fn buy(
    input: web::Json<BuyRequest>,
    client: WebNodeClient,
    indexer_client: IndexerClient,
) -> Result<HttpResponse> {
    let identity = Identity(input.user.clone());
    let blob_tx = get_blob_tx_buy(&input, &identity).await.unwrap();

    let tx_hash = client
        .get_ref()
        .as_ref()
        .send_tx_blob(&blob_tx)
        .await
        .map_err(|e| {
            actix_web::error::ErrorInternalServerError(format!(
                "Failed to send blob transaction: {}",
                e
            ))
        })?;

    let simple_identity_proof_data = get_proof_data(
        &blob_tx,
        tx_hash.to_string(),
        &indexer_client,
        ID_ELF,
        "simple-identity".into(),
        0.into(),
    )
    .await
    .unwrap();

    eprintln!("sending tx proof simple-identity");
    client
        .send_tx_proof(&ProofTransaction {
            contract_name: "simple-identity".into(),
            proof: simple_identity_proof_data,
        })
        .await
        .unwrap();

    let contract_proof_data = get_proof_data(
        &blob_tx,
        tx_hash.to_string(),
        &indexer_client,
        METHOD_ELF,
        "buy-my-tweet".into(),
        1.into(),
    )
    .await
    .unwrap();

    eprintln!("sending tx proof buy-my-tweet");
    client
        .send_tx_proof(&ProofTransaction {
            contract_name: "buy-my-tweet".into(),
            proof: contract_proof_data,
        })
        .await
        .unwrap();

    let token_proof_data = get_proof_data(
        &blob_tx,
        tx_hash.to_string(),
        &indexer_client,
        TOKEN_ELF,
        "simple-token".into(),
        2.into(),
    )
    .await
    .unwrap();

    eprintln!("sending tx proof simple-token");
    client
        .send_tx_proof(&ProofTransaction {
            contract_name: "simple-token".into(),
            proof: token_proof_data,
        })
        .await
        .unwrap();

    Ok(HttpResponse::Ok().json("ok"))
}

#[derive(Debug, Serialize, Deserialize)]
struct FaucetRequest {
    user: String,
    nonce: u32,
}

async fn get_blob_tx_faucet(
    input: web::Json<FaucetRequest>,
    identity: &Identity,
    indexer_client: &IndexerClient,
) -> Result<BlobTransaction> {
    let simple_identity_cn = ContractName("simple-identity".to_string());
    let simple_token_cn = ContractName("simple-token".to_string());

    let id_action = hyle_sdk::identity_provider::IdentityAction::VerifyIdentity {
        account: identity.to_string(),
        nonce: input.nonce,
    };

    let token_action = hyle_sdk::erc20::ERC20Action::Transfer {
        recipient: input.user.clone(),
        amount: 1000,
    };
    let blobs = vec![
        Blob {
            contract_name: simple_identity_cn.clone(),
            data: hyle_sdk::BlobData(
                bincode::encode_to_vec(id_action, bincode::config::standard())
                    .expect("failed to encode BlobData"),
            ),
        },
        Blob {
            contract_name: simple_token_cn.clone(),
            data: BlobData(
                bincode::encode_to_vec(token_action, bincode::config::standard())
                    .expect("failed to encode BlobData"),
            ),
        },
    ];

    println!("{}", blobs.len());

    Ok(BlobTransaction {
        identity: identity.clone(),
        blobs,
    })
}

async fn faucet(
    input: web::Json<FaucetRequest>,
    client: WebNodeClient,
    indexer_client: IndexerClient,
) -> Result<HttpResponse> {
    let blob_tx = get_blob_tx_faucet(
        input,
        &Identity("faucet.simple-identity".to_string()),
        &indexer_client,
    )
    .await
    .unwrap();

    let tx_hash = client
        .get_ref()
        .as_ref()
        .send_tx_blob(&blob_tx)
        .await
        .map_err(|e| {
            actix_web::error::ErrorInternalServerError(format!(
                "Failed to send blob transaction: {}",
                e
            ))
        })?;

    let simple_identity_proof_data = get_proof_data(
        &blob_tx,
        tx_hash.to_string(),
        &indexer_client,
        ID_ELF,
        "simple-identity".into(),
        0.into(),
    )
    .await
    .unwrap();

    client
        .send_tx_proof(&ProofTransaction {
            contract_name: "simple-identity".into(),
            proof: simple_identity_proof_data,
        })
        .await
        .unwrap();
    let simple_token_proof_data = get_proof_data(
        &blob_tx,
        tx_hash.to_string(),
        &indexer_client,
        TOKEN_ELF,
        "simple-token".into(),
        1.into(),
    )
    .await
    .unwrap();

    client
        .send_tx_proof(&ProofTransaction {
            contract_name: "simple-token".into(),
            proof: simple_token_proof_data,
        })
        .await
        .unwrap();
    Ok(HttpResponse::Ok().json("ok"))
}

#[derive(Deserialize)]
pub struct StateQuery {
    #[serde(rename = "contractName")]
    contract_name: String,
}

pub async fn get_state(
    query: web::Query<StateQuery>,
    node_client: IndexerClient,
) -> Result<HttpResponse> {
    let contract_name = &query.contract_name;
    println!("fetching {}", contract_name);

    // Call node API to get contract state
    let state: BuyMyTweetState = node_client
        .fetch_current_state(&contract_name.into())
        .await
        .map_err(|e| {
            actix_web::error::ErrorInternalServerError(format!(
                "Failed to fetch contract state: {}",
                e
            ))
        })?;

    println!("{:?}", state.users);

    // Return the response as JSON
    Ok(HttpResponse::Ok().json(state))
}
#[derive(Serialize, Deserialize)]
pub struct NonceResponse {
    nonce: u32,
}
#[derive(Serialize, Deserialize)]
pub struct NonceQuery {
    username: String,
}

pub async fn get_nonce(
    query: web::Query<NonceQuery>,
    node_client: IndexerClient,
) -> Result<HttpResponse> {
    let username = &query.username;
    println!("fetching nonce for {}", username);

    // Call node API to get contract state
    let state: contract_identity::IdentityContractState = node_client
        .fetch_current_state(&"simple-identity".into())
        .await
        .map_err(|e| {
            actix_web::error::ErrorInternalServerError(format!(
                "Failed to fetch contract state: {}",
                e
            ))
        })?;

    let nonce = state
        .identities
        .get(username)
        .map(|identity| identity.nonce)
        .ok_or_else(|| {
            actix_web::error::ErrorNotFound(format!("Identity not found for user: {}", username))
        })?;

    // Return the response as JSON
    Ok(HttpResponse::Ok().json(NonceResponse { nonce }))
}

pub async fn get_balances(node_client: IndexerClient) -> Result<HttpResponse> {
    println!("get balances");
    // Call node API to get contract state
    let state: contract_token::TokenContractState = node_client
        .fetch_current_state(&"simple-token".into())
        .await
        .map_err(|e| {
            actix_web::error::ErrorInternalServerError(format!(
                "Failed to fetch contract state: {}",
                e
            ))
        })?;

    // Return the response as JSON
    Ok(HttpResponse::Ok().json(state))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Starting server on http://127.0.0.1:8180");
    let node_url = env::var("NODE_URL").unwrap_or_else(|_| "http://localhost:4321".to_string());
    let indexer_url =
        env::var("INDEXER_URL").unwrap_or_else(|_| "http://localhost:4321".to_string());
    let indexer_client = Arc::new(IndexerApiHttpClient {
        url: Url::parse(indexer_url.as_str()).unwrap(),
        reqwest_client: Client::new(),
    });
    let node_client = Arc::new(NodeApiHttpClient {
        url: Url::parse(node_url.as_str()).unwrap(),
        reqwest_client: Client::new(),
    });

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(node_client.clone()))
            .app_data(web::Data::new(indexer_client.clone()))
            .route("/blobs/register", web::post().to(register))
            .route("/contracts/register", web::post().to(register_contract))
            .route("/contracts/faucet", web::post().to(faucet))
            .route("/contracts/buy", web::post().to(buy))
            .route("/contracts/claim", web::post().to(claim))
            .route("/contracts/transfer", web::post().to(transfer))
            .route("/contracts/state", web::get().to(get_state))
            .route("/user/nonce", web::get().to(get_nonce))
            .route("/user/balances", web::get().to(get_balances))
    })
    .bind("127.0.0.1:8180")?
    .run()
    .await
}
