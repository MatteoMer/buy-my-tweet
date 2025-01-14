import { NextResponse } from 'next/server'
import varint from 'varint'
import { Blob, NodeApiHttpClient, BlobTransaction } from '@/lib/hyle'

// Configure the Hyle client
// You might want to move this to an environment variable
const HYLE_NODE_URL = process.env.HYLE_NODE_URL || 'http://localhost:4321'
const nodeClient = new NodeApiHttpClient(HYLE_NODE_URL)

interface ReclaimContext {
    providerHash: string;
    extractedParameters: any;
}

interface ReclaimProof {
    claimData: {
        context: string;
    };
}

function createReclaimBlob(contractName: string, proof: ReclaimProof): Blob {
    const context: ReclaimContext = JSON.parse(proof.claimData.context);
    return {
        contract_name: contractName,
        data: [...new TextEncoder().encode(JSON.stringify(context.extractedParameters))]
    };
}


export async function POST(request: Request) {
    try {
        const body = await request.json();
        if (!body.proof) {
            return NextResponse.json(
                { error: 'Proof is required in request body' },
                { status: 400 }
            );
        }

        // Create the blob
        const blob = createReclaimBlob("reclaim-test", body.proof as ReclaimProof);
        console.log(blob)

        // Create the blob transaction
        const blobTx: BlobTransaction = {
            identity: "test.reclaim-test",
            blobs: [blob]
        };
        console.log(blobTx)

        const response = await fetch(`${HYLE_NODE_URL}/v1/tx/send/blob`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(blobTx)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send blob transaction: ${errorText}`);
        }

        const txHash = await response.text(); // Directly read the response as text since it's just the hash

        return NextResponse.json({
            txHash,
            success: true
        });
    } catch (error) {
        console.error('Error creating reclaim blob:', error);
        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: 'Invalid proof format' },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
