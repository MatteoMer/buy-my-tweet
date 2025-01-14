import { NextRequest, NextResponse } from 'next/server'
import { NodeApiHttpClient, HyleUtils } from '@/lib/hyle'

const nodeClient = new NodeApiHttpClient(process.env.HYLE_NODE_URL || 'http://localhost:4321')

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { contractName, guestId, owner = 'test', verifier = 'reclaim' } = body

        // Validate required parameters
        if (!contractName || !guestId) {
            return NextResponse.json(
                { error: 'Missing required parameters: contractName and guestId' },
                { status: 400 }
            )
        }

        // Validate guestId format
        if (!/^[0-9a-fA-F]{64}$/.test(guestId)) {
            return NextResponse.json(
                { error: 'guestId must be a 64-character hex string' },
                { status: 400 }
            )
        }

        // Create empty initial state
        const emptyState = new Uint8Array(32)

        // Convert guest ID from hex string to byte array
        const guestIdBytes = HyleUtils.hexStringToBytes(guestId)

        // Create register transaction
        const registerTx = {
            owner,
            verifier,
            program_id: Array.from(guestIdBytes),
            state_digest: Array.from(emptyState),
            contract_name: contractName,
        }

        // Send transaction
        const response = await nodeClient.sendTxRegisterContract(registerTx)
        const txHash = await response.text()

        return NextResponse.json({
            success: true,
            txHash,
            contractName,
            owner
        })

    } catch (error) {
        console.error('Error registering contract:', error)
        return NextResponse.json(
            { error: 'Failed to register contract' },
            { status: 500 }
        )
    }
}
