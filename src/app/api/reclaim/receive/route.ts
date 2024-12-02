import { Proof, verifyProof } from '@reclaimprotocol/js-sdk'
import { NextResponse } from 'next/server'
import { redis } from '../../../../lib/redis'

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
                // Store proof in Redis with a unique key
                const proofKey = `proof:${Date.now()}`
                await redis.set(proofKey, JSON.stringify({
                    proof,
                    status: 200,
                    timestamp: Date.now()
                }))

                // Store the latest proof key for polling
                await redis.set('latest_proof', proofKey)

                return NextResponse.json({ proof: proof }, { status: 200 })
            } else {
                await redis.set('latest_proof_error', JSON.stringify({
                    error: 'Proof verification failed',
                    status: 400,
                    timestamp: Date.now()
                }))
                return NextResponse.json({ message: 'Proof is not valid' }, { status: 400 })
            }
        } catch (verificationError) {
            console.error('Error verifying proof:', verificationError)
            await redis.set('latest_proof_error', JSON.stringify({
                error: 'Proof verification error',
                status: 400,
                timestamp: Date.now()
            }))
            return NextResponse.json({ message: 'Error verifying proof' }, { status: 400 })
        }
    } catch (error) {
        console.error('Error processing proof:', error)
        await redis.set('latest_proof_error', JSON.stringify({
            error: 'Error processing proof',
            status: 500,
            timestamp: Date.now()
        }))
        return NextResponse.json(
            { error: 'Error processing proof' },
            { status: 500 }
        )
    }
}
