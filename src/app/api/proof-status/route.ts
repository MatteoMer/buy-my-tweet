import { NextResponse } from 'next/server'
import { redis } from '../../../lib/redis'

export const runtime = 'edge';

export async function GET() {
    try {
        // Get the latest proof key
        const latestProofKey = await redis.get('latest_proof')
        if (!latestProofKey) {
            // Check for errors
            const error = await redis.get('latest_proof_error')
            if (error) {
                return NextResponse.json(JSON.parse(error as string))
            }
            return NextResponse.json({ status: 'pending' })
        }

        // Get the actual proof data
        const proofData = await redis.get(latestProofKey as string)
        return NextResponse.json(JSON.parse(proofData as string))
    } catch (error) {
        console.error('Error fetching proof status:', error)
        return NextResponse.json(
            { error: 'Error fetching proof status' },
            { status: 500 }
        )
    }
}
