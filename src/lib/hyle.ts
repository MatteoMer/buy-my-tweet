// lib/hyle.ts

// Basic types from SDK
export type TxHash = string;
export type BlockHeight = number;
export type ContractName = string;
export type StateDigest = string;
export type Identity = string;
export type ValidatorPublicKey = string; // Assuming this is a string-based key
export type ProgramId = string;
export type Verifier = string;

export interface HyleOutput {
    version: number;
    initial_state: StateDigest;
    next_state: StateDigest;
    identity: Identity;
    tx_hash: TxHash;
    index: number;
    blobs: number[];
    success: boolean;
    program_outputs: number[];
}

// Core interfaces matching Rust types
export interface Blob {
    contract_name: ContractName;
    data: number[];
}

export interface BlobTransaction {
    identity: Identity;
    blobs: Blob[];
}

export interface ProofTransaction {
    contract_name: ContractName;
    proof: number[];
}

export interface RegisterContractTransaction {
    owner: string;
    verifier: Verifier;
    program_id: number[];
    state_digest: number[];
    contract_name: ContractName;
}

export interface ConsensusInfo {
    slot: number;
    view: number;
    round_leader: ValidatorPublicKey;
    validators: ValidatorPublicKey[];
}

export interface NodeInfo {
    id: string;
    pubkey?: ValidatorPublicKey;
    da_address: string;
}

export interface Contract {
    name: ContractName;
    program_id: ProgramId;
    state: StateDigest;
    verifier: Verifier;
}

export interface ContractDb {
    tx_hash: TxHash;
    owner: string;
    verifier: string;
    program_id: number[];
    state_digest: number[];
    contract_name: string;
}

export enum TransactionType {
    BlobTransaction = 'blob_transaction',
    ProofTransaction = 'proof_transaction',
    RegisterContractTransaction = 'register_contract_transaction',
    Stake = 'stake',
}

export enum TransactionStatus {
    Success = 'success',
    Failure = 'failure',
    Sequenced = 'sequenced',
    TimedOut = 'timed_out',
}

class ApiError extends Error {
    constructor(message: string, public context?: string) {
        super(message);
        this.name = 'ApiError';
    }
}

export class NodeApiHttpClient {
    private url: string;

    constructor(url: string) {
        this.url = url.endsWith('/') ? url : url + '/';
    }

    private async handleResponse<T>(response: Response, context: string): Promise<T> {
        if (!response.ok) {
            throw new ApiError(`HTTP error! status: ${response.status}`, context);
        }
        try {
            return await response.json() as T;
        } catch (error) {
            throw new ApiError(`Failed to parse JSON response: ${error}`, context);
        }
    }

    async sendTxBlob(tx: BlobTransaction): Promise<TxHash> {
        const response = await fetch(`${this.url}v1/tx/send/blob`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tx),
        });
        return this.handleResponse<TxHash>(response, 'Sending tx blob');
    }

    async sendTxProof(tx: ProofTransaction): Promise<Response> {
        return fetch(`${this.url}v1/tx/send/proof`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tx),
        });
    }

    async sendTxRegisterContract(tx: RegisterContractTransaction): Promise<Response> {
        return fetch(`${this.url}v1/contract/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tx),
        });
    }

    async getConsensusInfo(): Promise<ConsensusInfo> {
        const response = await fetch(`${this.url}v1/consensus/info`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return this.handleResponse<ConsensusInfo>(response, 'Getting consensus info');
    }

    async getNodeInfo(): Promise<NodeInfo> {
        const response = await fetch(`${this.url}v1/info`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return this.handleResponse<NodeInfo>(response, 'Getting node info');
    }

    async getBlockHeight(): Promise<BlockHeight> {
        const response = await fetch(`${this.url}v1/da/block/height`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return this.handleResponse<BlockHeight>(response, 'Getting block height');
    }

    async getContract(contractName: ContractName): Promise<Contract> {
        const response = await fetch(`${this.url}v1/contract/${contractName}`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return this.handleResponse<Contract>(response, `Getting Contract ${contractName}`);
    }
}

export class IndexerApiHttpClient {
    private url: string;

    constructor(url: string) {
        this.url = url.endsWith('/') ? url : url + '/';
    }

    private async handleResponse<T>(response: Response, context: string): Promise<T> {
        if (!response.ok) {
            throw new ApiError(`HTTP error! status: ${response.status}`, context);
        }
        try {
            return await response.json() as T;
        } catch (error) {
            throw new ApiError(`Failed to parse JSON response: ${error}`, context);
        }
    }

    async listContracts(): Promise<ContractDb[]> {
        const response = await fetch(`${this.url}v1/indexer/contracts`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return this.handleResponse<ContractDb[]>(response, 'Getting contracts');
    }

    async getIndexerContract(contractName: ContractName): Promise<Response> {
        return fetch(`${this.url}v1/indexer/contract/${contractName}`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Fetches and converts the current state of a contract
     * @param contractName The name of the contract
     * @param converter A function to convert from StateDigest to the desired state type
     * @throws ApiError if the request fails or state conversion fails
     */
    async fetchCurrentState<State>(
        contractName: ContractName,
        converter: (stateDigest: number[]) => State | Promise<State>
    ): Promise<State> {
        const response = await this.getIndexerContract(contractName);
        const contractDb = await this.handleResponse<ContractDb>(response, 'Fetching current state');

        try {
            return await Promise.resolve(converter(contractDb.state_digest));
        } catch (error) {
            throw new ApiError(`Failed to convert state: ${error}`, 'State conversion');
        }
    }

    /**
     * Helper method to convert hex string state digest to byte array
     */
    static hexToBytes(hex: string): number[] {
        const bytes: number[] = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.slice(i, i + 2), 16));
        }
        return bytes;
    }

    /**
     * Helper method to convert byte array to hex string
     */
    static bytesToHex(bytes: number[]): string {
        return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async queryIndexer(route: string): Promise<Response> {
        return fetch(`${this.url}v1/${route}`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async getNodeInfo(): Promise<NodeInfo> {
        const response = await fetch(`${this.url}v1/info`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return this.handleResponse<NodeInfo>(response, 'Getting node info');
    }
}

export class HyleUtils {
    /**
     * Converts a hex string to a byte array
     */
    static hexStringToBytes(hexString: string): Uint8Array {
        // Remove '0x' prefix if present
        const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;

        // Ensure the string has even length
        if (cleanHex.length % 2 !== 0) {
            throw new Error('Hex string must have an even number of characters');
        }

        const bytes = new Uint8Array(cleanHex.length / 2);

        for (let i = 0; i < cleanHex.length; i += 2) {
            const byteValue = parseInt(cleanHex.substr(i, 2), 16);
            if (isNaN(byteValue)) {
                throw new Error(`Invalid hex characters at position ${i}`);
            }
            bytes[i / 2] = byteValue;
        }

        return bytes;
    }
}

export async function registerContract(
    client: NodeApiHttpClient,
    contractName: string,
    guestId: string, // Hex string
    options = {
        owner: 'test',
        verifier: 'reclaim'
    }
): Promise<string> {
    // Create empty initial state
    const emptyState = new Uint8Array(32);
    console.log('Initial state:', Buffer.from(emptyState).toString('hex'));

    // Convert guest ID from hex string to byte array
    const guestIdBytes = HyleUtils.hexStringToBytes(guestId);

    // Create register transaction
    const registerTx: RegisterContractTransaction = {
        owner: options.owner,
        verifier: options.verifier,
        program_id: Array.from(guestIdBytes),
        state_digest: Array.from(emptyState),
        contract_name: contractName,
    };

    // Send transaction
    try {
        const response = await client.sendTxRegisterContract(registerTx);
        const txHash = await response.text();
        console.log('✅ Register contract tx sent. Tx hash:', txHash);
        return txHash;
    } catch (error) {
        console.error('Failed to register contract:', error);
        throw error;
    }
}
