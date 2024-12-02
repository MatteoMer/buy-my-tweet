import { Proof, verifyProof } from '@reclaimprotocol/js-sdk'
import { sendEventToClients, clients } from '../../../utils/eventUtils';
import { NextResponse } from 'next/server'

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        const rawProof = await request.text();
        const decodedProof = decodeURIComponent(rawProof);
        const proof = JSON.parse(decodedProof) as Proof;
        console.log('Received proofs:', proof)

        try {
            const isProofVerified = await verifyProof(proof)
            if (isProofVerified) {
                console.log(clients)
                await sendEventToClients({ proof: proof, status: 200 })
                return NextResponse.json({ proof: proof }, { status: 200 })
            } else {
                await sendEventToClients({ error: 'Proof verification failed', status: 400 })
                return NextResponse.json({ message: 'Proof is not valid' }, { status: 400 })
            }
        } catch (verificationError) {
            console.error('Error verifying proof:', verificationError)
            await sendEventToClients({ error: 'Proof verification error', status: 400 })
            return NextResponse.json({ message: 'Error verifying proof' }, { status: 400 })
        }
    } catch (error) {
        console.error('Error processing proof:', error)
        await sendEventToClients({ error: 'Error processing proof', status: 500 })
        return NextResponse.json(
            { error: 'Error processing proof' },
            { status: 500 }
        )
    }
}

