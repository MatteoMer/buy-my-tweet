use actix_web::{web, App, HttpResponse, HttpServer, Result};
use lib::{contract::BuyMyTweetAction, Processor, RiscZeroZkvmProcessor, ZkvmProcessor};
use methods::{METHOD_ELF, METHOD_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};

async fn process_request(input: web::Json<BuyMyTweetAction>) -> Result<HttpResponse> {
    // Create executor environment with the received input
    let env = ExecutorEnv::builder()
        .write(&input.0)
        .map_err(|e| {
            actix_web::error::ErrorInternalServerError(format!(
                "Failed to build environment: {}",
                e
            ))
        })?
        .build()
        .map_err(|e| {
            actix_web::error::ErrorInternalServerError(format!(
                "Failed to build environment: {}",
                e
            ))
        })?;

    // Get the default prover
    let prover = default_prover();

    println!("[risczero] Generating proof!");

    // Generate and verify proof
    let prove_info = prover.prove(env, METHOD_ELF).map_err(|e| {
        actix_web::error::ErrorInternalServerError(format!("Proof generation failed: {}", e))
    })?;

    let receipt = prove_info.receipt;

    receipt.verify(METHOD_ID).map_err(|e| {
        actix_web::error::ErrorInternalServerError(format!("Proof verification failed: {}", e))
    })?;

    println!("[risczero] Successfully verified proof!");

    // Process outputs
    let internal_outputs = Processor::process_internal_outputs(&receipt);
    Processor::process_outputs(internal_outputs.clone());

    Ok(HttpResponse::Ok().json(internal_outputs))
}

struct TransferRequest {
    recipient: String,
    amount: u128,
}

async fn create_blob_transfer(input: web::Json<TransferRequest>) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(input))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    println!("Starting server on http://127.0.0.1:8080");

    HttpServer::new(|| App::new().route("/process", web::post().to(process_request)))
        .bind("127.0.0.1:8080")?
        .run()
        .await
}
