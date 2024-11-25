import { Proof, verifyProof } from '@reclaimprotocol/js-sdk'

import { NextResponse } from 'next/server'

// Store connected clients
const clients = new Set<WritableStreamDefaultWriter>();

// Handle SSE connections
export async function GET() {
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    clients.add(writer);

    (stream.readable as any).closed.then(() => {
        clients.delete(writer);
    });

    return new NextResponse(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}


export async function POST(request: Request) {
    try {
        const rawProof = await request.text();
        const decodedProof = decodeURIComponent(rawProof);
        const proof = JSON.parse(decodedProof) as Proof;
        console.log('Received proofs:', proof)

        const isProofVerified = await verifyProof(proof)
        if (isProofVerified) {
            // Notify all connected clients
            const message = `data: ${JSON.stringify(proof)}\n\n`;
            const encoder = new TextEncoder();
            clients.forEach(client => {
                client.write(encoder.encode(message)).catch(() => {
                    clients.delete(client);
                });
            });

            return NextResponse.json({ proof: proof }, { status: 200 })
        } else {
            return NextResponse.json({ message: 'Proof is not valid' }, { status: 400 })
        }
    } catch (error) {
        console.error('Error processing proof:', error)
        return NextResponse.json(
            { error: 'Error processing proof' },
            { status: 500 }
        )
    }
}

