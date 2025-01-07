import { Proof, verifyProof } from '@reclaimprotocol/js-sdk'
import { storeProof } from '@/lib/redis'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const rawProof = await request.text();
        const decodedProof = decodeURIComponent(rawProof);
        const proof = JSON.parse(decodedProof) as Proof;
        console.log('Received proof:')
        console.log('identifier:', proof.identifier)
        console.log('claimData:', proof.claimData)
        console.log('signatures:', proof.signatures)
        console.log('witnesses:', proof.witnesses)
        console.log('extractedParameterValues:', proof.extractedParameterValues)
        console.log('publicData:', proof.publicData)


        try {
            const isProofVerified = await verifyProof(proof)
            if (isProofVerified) {
                await storeProof({ proof: proof, status: 200 });
                return NextResponse.json({ proof: proof }, { status: 200 })
            } else {
                await storeProof({ error: 'Proof verification failed', status: 400 });
                return NextResponse.json({ message: 'Proof is not valid' }, { status: 400 })
            }
        } catch (verificationError) {
            console.error('Error verifying proof:', verificationError)
            await storeProof({ error: 'Proof verification error', status: 400 });
            return NextResponse.json({ message: 'Error verifying proof' }, { status: 400 })
        }
    } catch (error) {
        console.error('Error processing proof:', error)
        await storeProof({ error: 'Error processing proof', status: 500 });
        return NextResponse.json(
            { error: 'Error processing proof' },
            { status: 500 }
        )
    }
}
