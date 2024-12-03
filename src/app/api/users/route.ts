import { NextResponse } from 'next/server';

interface User {
    id: number;
    name: string;
    username: string;
    price: number;
}

// TODO: Get from hyle state
const users: User[] = [
    { id: 1, name: 'John Doe', username: '@johndoe', price: 100 },
    { id: 2, name: 'Jane Smith', username: '@janesmith', price: 10 },
    { id: 3, name: 'Bob Johnson', username: '@bobjohnson', price: 1 },
    { id: 4, name: 'Alice Brown', username: '@alicebrown', price: 100 },
];

export async function GET() {
    try {
        return NextResponse.json({ users }, { status: 200 });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}
