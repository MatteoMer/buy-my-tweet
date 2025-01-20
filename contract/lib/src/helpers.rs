use crate::reclaim::ReclaimVerifyContractData;
use hyle_sdk::{Blob, ContractInput, StateDigest};
use std::fs::File;
use std::io::BufReader;

pub fn get_claim_tweet_input() -> ContractInput {
    let file = File::open("./proof-examples/reclaim-contract.json").unwrap();
    let reader = BufReader::new(file);

    let config_contract: ReclaimVerifyContractData =
        serde_json::from_reader(reader).expect("cannot read");

    let file = File::open("./proof-examples/reclaim.json").unwrap();
    let reader = BufReader::new(file);

    let config_proof: serde_json::Value = serde_json::from_reader(reader).expect("cannot read");

    // reclaim ZKVM contract blob format is in JSON

    let blobs = vec![
        Blob {
            contract_name: hyle_sdk::ContractName("buy-my-tweet-contract".into()),
            data: hyle_sdk::BlobData(
                serde_json::to_string(&config_contract)
                    .expect("cannot convert")
                    .as_bytes()
                    .to_vec(),
            ),
        },
        Blob {
            contract_name: hyle_sdk::ContractName("buy-my-tweet-reclaim-proof".into()),
            data: hyle_sdk::BlobData(
                serde_json::to_string(&config_proof)
                    .expect("cannot convert")
                    .as_bytes()
                    .to_vec(),
            ),
        },
    ];

    ContractInput {
        initial_state: StateDigest(vec![]),
        blobs,
        identity: hyle_sdk::Identity("buy-my-tweet-verify-reclaim".into()),
        index: hyle_sdk::BlobIndex(0),
        private_blob: hyle_sdk::BlobData(vec![]),
        tx_hash: hyle_sdk::TxHash("".into()),
    }
}
