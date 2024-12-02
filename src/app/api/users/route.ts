import { NextResponse } from 'next/server';

interface User {
    id: number;
    name: string;
    username: string;
}

// TODO: Get from hyle state
const users: User[] = [
    { id: 1, name: 'John Doe', username: '@johndoe' },
    { id: 2, name: 'Jane Smith', username: '@janesmith' },
    { id: 3, name: 'Bob Johnson', username: '@bobjohnson' },
    { id: 4, name: 'Alice Brown', username: '@alicebrown' },
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
