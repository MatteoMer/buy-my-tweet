import { NextResponse } from 'next/server'
import { clearProof } from '@/lib/redis';

interface ClaimRequest {
    username: string;
    amount: number;
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
    // Implement your claim processing logic here
    // This is just a placeholder
    return true;
}
