import { Proof, verifyProof } from '@reclaimprotocol/js-sdk'

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    console.log(request)
    try {
        const rawProof = await request.text();
        const decodedProof = decodeURIComponent(rawProof);
        const proof = JSON.parse(decodedProof) as Proof;
        console.log('Received proofs:', proof)

        const isProofVerified = await verifyProof(proof)
        if (isProofVerified) {
            return NextResponse.json({ proof: proof }, { status: 200 })
        } else {
            return NextResponse.json({ message: 'Proof is not valid' }, { status: 400 })
        }
    } catch (error) {
        // Handle any errors
        console.error('Error processing proof:', error)
        return NextResponse.json(
            { error: 'Error processing proof' },
            { status: 500 }
        )
    }
}

