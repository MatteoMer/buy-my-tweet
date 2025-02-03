export interface BuyMyTweetMessage {
    content: string;
    status: boolean;
}

export interface BuyMyTweetUser {
    id: string;
    price: number;  // u64 in Rust maps to number in TypeScript
    messages: BuyMyTweetMessage[];
}

export interface BuyMyTweetState {
    users: Record<string, BuyMyTweetUser>;
}

export function buyMyTweetStateToBytes(state: BuyMyTweetState): number[] {
    try {
        // Validate the state before converting
        validateState(state);

        // Convert to JSON string
        const jsonString = JSON.stringify(state);

        // Convert string to byte array
        const encoder = new TextEncoder();
        const bytes = encoder.encode(jsonString);

        // Convert Uint8Array to number array
        return Array.from(bytes);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to convert state to bytes: ${error.message}`);
        }
        throw new Error('Failed to convert state to bytes: unknown error');
    }
}

export function buyMyTweetStateFromBytes(stateDigest: number[]): BuyMyTweetState {
    // Convert the byte array to a string
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(new Uint8Array(stateDigest));

    try {
        // Parse the JSON string into our TypeScript type
        const state = JSON.parse(jsonString) as BuyMyTweetState;

        // Validate the parsed state
        validateState(state);

        return state;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to parse state: ${error.message}`);
        }
        throw new Error('Failed to parse state: unknown error');
    }
}

function validateState(state: BuyMyTweetState): void {
    if (typeof state !== 'object' || state === null) {
        throw new Error('Invalid state: expected an object');
    }

    if (!state.users || typeof state.users !== 'object') {
        throw new Error('Invalid state: missing or invalid users map');
    }

    // Validate each user in the map
    for (const [key, user] of Object.entries(state.users)) {
        if (!user.id || typeof user.id !== 'string') {
            throw new Error(`Invalid user id for key ${key}`);
        }

        if (typeof user.price !== 'number' || !Number.isInteger(user.price) || user.price < 0) {
            throw new Error(`Invalid price for user ${key}`);
        }

        if (!Array.isArray(user.messages)) {
            throw new Error(`Invalid messages array for user ${key}`);
        }

        // Validate each message
        for (const [index, message] of user.messages.entries()) {
            if (typeof message.content !== 'string') {
                throw new Error(`Invalid message content at index ${index} for user ${key}`);
            }

            if (typeof message.status !== 'boolean') {
                throw new Error(`Invalid message status at index ${index} for user ${key}`);
            }
        }
    }
}

