import { console } from 'inspector';
import { NextResponse } from 'next/server'

interface ContractRequest {
    user: string;
    amount: string;
    message: string;
    receiver: string;
}

interface ContractData {
    user: string;
    amount: string;
    message: string;
    receiver: string;
    nonce: number;
}

export async function POST(request: Request) {
    try {
        const body: ContractRequest = await request.json();

        const response = await fetch(`http://localhost:8180/user/nonce?username=${body.user}`, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }


        const result = await response.json();
        console.log(`nonce: ${JSON.stringify(result)}`)

        const success = await processContractPurchase({
            ...body,
            nonce: result.nonce,
        });

        if (success) {
            return NextResponse.json({
                success: true,
                message: 'Contract purchased successfully'
            });
        } else {
            throw new Error('Contract purchase failed');
        }

    } catch (error) {
        console.error('Error processing contract purchase:', error);
        return NextResponse.json({
            error: 'Failed to process contract purchase'
        }, { status: 500 });
    }
}

async function processContractPurchase(data: ContractData): Promise<boolean> {
    try {
        const response = await fetch('http://localhost:8180/contracts/buy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return true;
    } catch (error) {
        console.error('Error in contract purchase:', error);
        return false;
    }
}
