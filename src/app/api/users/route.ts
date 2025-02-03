import { NextResponse } from 'next/server';

interface User {
    id: number;
    name: string;
    username: string;
    price: number;
}

interface RawUser {
    id: string;
    price: number;
    messages: string[];
}

interface ApiResponse {
    users: {
        [key: string]: RawUser;
    };
}

export async function GET() {
    try {
        const response = await fetch(
            "http://127.0.0.1:8180/contracts/state?contractName=buy-my-tweet"
        );

        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }

        const data: ApiResponse = await response.json();

        // Transform the data into the expected User format
        const transformedUsers: User[] = Object.entries(data.users).map(([key, user], index) => ({
            id: index + 1,
            name: key.split('.')[0], // Take the first part of the ID before the dot
            username: `${key}`,
            price: user.price
        }));

        return NextResponse.json({ users: transformedUsers }, { status: 200 });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}
