import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const response = await fetch('http://localhost:8180/user/balances');
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
    }
} 