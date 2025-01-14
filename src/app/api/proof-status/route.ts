import { getLatestProof } from '@/lib/redis'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const latestProof = await getLatestProof();
        console.log(latestProof)
        return NextResponse.json({ proof: latestProof || null })
    } catch (error) {
        console.error('Error fetching proof status:', error)
        return NextResponse.json(null, { status: 500 })
    }
}
