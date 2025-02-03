import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username } = body;

        // First, get the nonce
        const nonceResponse = await fetch(`http://localhost:8180/user/nonce?username=faucet.simple-identity`, {
            method: 'GET',
        });

        if (!nonceResponse.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch nonce' },
                { status: nonceResponse.status }
            );
        }

        const nonceResult = await nonceResponse.json();

        // Then call the faucet endpoint
        const faucetResponse = await fetch('http://localhost:8180/contracts/faucet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user: username,
                nonce: nonceResult.nonce
            })
        });

        if (!faucetResponse.ok) {
            return NextResponse.json(
                { error: 'Failed to call faucet' },
                { status: faucetResponse.status }
            );
        }

        const faucetResult = await faucetResponse.json();
        return NextResponse.json(faucetResult);

    } catch (error) {
        console.error('Faucet API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
