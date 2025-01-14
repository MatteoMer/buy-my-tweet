import { NextResponse } from 'next/server'
import { NodeApiHttpClient, ProofTransaction } from '@/lib/hyle'

const HYLE_NODE_URL = process.env.HYLE_NODE_URL || 'http://localhost:4321'
const nodeClient = new NodeApiHttpClient(HYLE_NODE_URL)

export async function POST(request: Request) {
    try {
        const body = await request.json();
        if (!body.proof) {
            return NextResponse.json(
                { error: 'Proof is required in request body' },
                { status: 400 }
            );
        }

        // Create the proof transaction
        const proofTx: ProofTransaction = {
            contract_name: "reclaim-test",
            proof: body.proof.proof
        };

        const response = await nodeClient.sendTxProof(proofTx);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send proof transaction: ${errorText}`);
        }

        const result = await response.text();

        return NextResponse.json({
            result,
            success: true
        });
    } catch (error) {
        console.error('Error sending proof transaction:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
