import { NextResponse } from 'next/server'
import { ContractInput, Blob } from '@/lib/hyle'

interface BuyMyTweetAction {
    Claim?: { input: ContractInput };
    Register?: { input: ContractInput };
    Buy?: { input: ContractInput };
}

// Type guard for Blob
function isBlob(value: unknown): value is Blob {
    const blob = value as Blob;
    return (
        !!blob &&
        typeof blob === 'object' &&
        typeof blob.contract_name === 'string' &&
        Array.isArray(blob.data)
    );
}

// Type guard for ContractInput
function isContractInput(value: unknown): value is ContractInput {
    const input = value as ContractInput;
    return (
        !!input &&
        typeof input === 'object' &&
        typeof input.initial_state === 'string' &&
        typeof input.identity === 'string' &&
        typeof input.index === 'number' &&
        Array.isArray(input.blobs) &&
        input.blobs.every(isBlob) &&
        typeof input.tx_hash === 'string' &&
        Array.isArray(input.private_input)
    );
}

// Type guard for BuyMyTweetAction
function isBuyMyTweetAction(value: unknown): value is BuyMyTweetAction {
    const action = value as BuyMyTweetAction;
    if (!action || typeof action !== 'object') return false;

    // Check if exactly one action type is present with valid input
    const hasClaimAction = 'Claim' in action &&
        !!action.Claim?.input &&
        isContractInput(action.Claim.input);

    const hasRegisterAction = 'Register' in action &&
        !!action.Register?.input &&
        isContractInput(action.Register.input);

    const hasBuyAction = 'Buy' in action &&
        !!action.Buy?.input &&
        isContractInput(action.Buy.input);

    return (
        (hasClaimAction && !hasRegisterAction && !hasBuyAction) ||
        (!hasClaimAction && hasRegisterAction && !hasBuyAction) ||
        (!hasClaimAction && !hasRegisterAction && hasBuyAction)
    );
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (!isBuyMyTweetAction(body)) {
            return NextResponse.json(
                { error: "Invalid action format. Must be a valid Claim, Register, or Buy action with complete ContractInput" },
                { status: 400 }
            );
        }

        // Call the Rust zkVM server
        const response = await fetch('http://localhost:8080/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: errorText },
                { status: response.status }
            );
        }

        const result = await response.json();
        return NextResponse.json(result);

    } catch (error) {
        console.error('Error processing request:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error },
            { status: 500 }
        );
    }
}
