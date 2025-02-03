import { NextResponse } from 'next/server'
import { clearProof } from '@/lib/redis';

interface ClaimRequest {
    username: string;
    amount: number;
    content: string;
}
interface HyleClaimRequest {
    username: string;
    message: string;
    nonce: number;
}
interface TransferRequest {
    to: string;
    from: string;
    amount: number;
    nonce: number;
}

export async function POST(request: Request) {
    try {
        const body: ClaimRequest = await request.json();
        if (!body.username || !body.amount) {
            return NextResponse.json({
                error: 'Missing required claim data'
            }, { status: 400 });
        }

        const success = await processClaimRequest(body);
        if (success) {
            await clearProof();
            return NextResponse.json({
                success: true,
                message: 'Reward claimed successfully'
            });
        } else {
            throw new Error('Claim processing failed');
        }
    } catch (error) {
        console.error('Error processing claim:', error);
        return NextResponse.json({
            error: 'Failed to process claim'
        }, { status: 500 });
    }
}

async function processClaimRequest(data: ClaimRequest): Promise<boolean> {

    try {

        // First, get the nonce
        const userNonceResponse = await fetch(`http://localhost:8180/user/nonce?username=${data.username}.simple-identity`, {
            method: 'GET',
        });

        if (!userNonceResponse.ok) {
            return false
        }

        const userNonceResult = await userNonceResponse.json();

        const claimRequest: HyleClaimRequest = {
            username: `${data.username}.simple-identity`,
            message: data.content,
            nonce: userNonceResult.nonce
        }

        const claimResponse = await fetch('http://localhost:8180/contracts/claim', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(claimRequest)
        });

        if (!claimResponse.ok) {
            throw new Error(`Transfer failed with status: ${claimResponse.status}`);
        }
        const faucetNonceResponse = await fetch(`http://localhost:8180/user/nonce?username=faucet.simple-identity`, {
            method: 'GET',
        });

        if (!faucetNonceResponse.ok) {
            return false
        }

        const faucetNonceResult = await faucetNonceResponse.json();
        const transferRequest: TransferRequest = {
            to: `${data.username}.simple-identity`,
            from: 'faucet.simple-identity',
            amount: data.amount,
            nonce: faucetNonceResult.nonce
        };

        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        console.log('1')
        await sleep(2000);
        console.log('2')

        const response = await fetch('http://localhost:8180/contracts/transfer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transferRequest)
        });

        if (!response.ok) {
            throw new Error(`Transfer failed with status: ${response.status}`);
        }

        const result = await response.json();
        return true;
    } catch (error) {
        console.error('Transfer request failed:', error);
        return false;
    }
}
