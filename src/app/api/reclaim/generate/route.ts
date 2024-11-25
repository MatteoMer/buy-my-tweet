import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

// Handle GET requests
export async function GET(request: NextRequest) {
    const APP_ID = process.env.RECLAIM_APP_ID
    const APP_SECRET = process.env.RECLAIM_APP_SECRET
    const PROVIDER_ID = process.env.RECLAIM_PROVIDER_ID

    if (!APP_ID || !APP_SECRET || !PROVIDER_ID) {
        return NextResponse.json(
            { error: 'Missing required environment variables' },
            { status: 500 }
        )
    }

    try {
        const reclaimProofRequest = await ReclaimProofRequest.init(
            APP_ID,
            APP_SECRET,
            PROVIDER_ID
        )

        reclaimProofRequest.setAppCallbackUrl(
            `${process.env.NEXT_PUBLIC_API_URL}/api/reclaim/receive-proofs`
        )

        const reclaimProofRequestConfig = reclaimProofRequest.toJsonString()

        return NextResponse.json({ reclaimProofRequestConfig })
    } catch (error) {
        console.error('Error generating request config:', error)
        return NextResponse.json(
            { error: 'Failed to generate request config' },
            { status: 500 }
        )
    }
}

// Add explicit handling for other HTTP methods
export async function POST() {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT() {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

// Handle CORS preflight requests
export async function OPTIONS() {
    return NextResponse.json({}, { status: 200 })
}
