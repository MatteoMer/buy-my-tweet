import { Proof, verifyProof } from '@reclaimprotocol/js-sdk'

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    console.log(request)
    try {
        // Parse the JSON body
        const proof: Proof = await request.json()

        // Log the received proofs
        console.log('Received proofs:', proof)

        const isProofVerified = await verifyProof(proof)
        if (isProofVerified) {
            return NextResponse.json({ message: 'Proof verified successfully' }, { status: 200 })
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

