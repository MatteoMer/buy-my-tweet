import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'


async function handlePost() {

    const POST_APP_ID = process.env.POST_RECLAIM_APP_ID
    const POST_APP_SECRET = process.env.POST_RECLAIM_APP_SECRET
    const POST_PROVIDER_ID = process.env.POST_RECLAIM_PROVIDER_ID

    if (!POST_APP_ID || !POST_APP_SECRET || !POST_PROVIDER_ID) {
        return NextResponse.json(
            { error: 'Missing required environment variables' },
            { status: 500 }
        )
    }

    try {
        const reclaimProofRequest = await ReclaimProofRequest.init(
            POST_APP_ID,
            POST_APP_SECRET,
            POST_PROVIDER_ID
        )

        reclaimProofRequest.setAppCallbackUrl(
            `${process.env.NEXT_PUBLIC_API_URL}/api/reclaim/receive?app=post`
        )
        reclaimProofRequest.addContext("0x48796C654F7574707574", "test") // 0x48796C654F7574707574 = HyleOutput

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

async function handleLogin() {

    const LOGIN_APP_ID = process.env.LOGIN_RECLAIM_APP_ID
    const LOGIN_APP_SECRET = process.env.LOGIN_RECLAIM_APP_SECRET
    const LOGIN_PROVIDER_ID = process.env.LOGIN_RECLAIM_PROVIDER_ID

    if (!LOGIN_APP_ID || !LOGIN_APP_SECRET || !LOGIN_PROVIDER_ID) {
        return NextResponse.json(
            { error: 'Missing required environment variables' },
            { status: 500 }
        )
    }

    try {
        const reclaimProofRequest = await ReclaimProofRequest.init(
            LOGIN_APP_ID,
            LOGIN_APP_SECRET,
            LOGIN_PROVIDER_ID
        )

        reclaimProofRequest.setAppCallbackUrl(
            `${process.env.NEXT_PUBLIC_API_URL}/api/reclaim/receive?app=login`
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

// Handle GET requests
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const app = searchParams.get('app')

    if (app === "post") {
        return handlePost()
    } else if (app === "login") {
        return handleLogin()
    } else {
        return NextResponse.json(
            { error: 'Wrong query param' },
            { status: 400 }
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
