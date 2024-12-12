import { NextResponse } from 'next/server';

interface Tweet {
    id: string;
    content: string;
    username: string;
    claimableAmount: number;
    isVerified: boolean;
}

// Dummy data with tweets from different users
const dummyTweets: Tweet[] = [
    {
        id: '1',
        content: 'tweet this',
        username: 'Matteo_Mer',
        claimableAmount: 100,
        isVerified: false
    },
    {
        id: '2',
        content: 'Judson\'s Abstract Algebra appreciation tweet\n\nhttp://abstract.ups.edu',
        username: 'Matteo_Mer',
        claimableAmount: 100,
        isVerified: false
    },
    {
        id: '3',
        content: 'Great experience with decentralized applications today. The future is here! #DeFi',
        username: 'bob_crypto',
        claimableAmount: 100,
        isVerified: false
    },
    {
        id: '4',
        content: 'Check out this revolutionary protocol for Web3 identity verification! #Web3',
        username: 'bob_crypto',
        claimableAmount: 60,
        isVerified: false
    }
];

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get('username');

        // Check if username is provided
        if (!username) {
            return NextResponse.json(
                { error: 'Username is required' },
                { status: 400 }
            );
        }

        // TODO: get tweet from hyle state
        const userTweets = dummyTweets.filter(
            tweet => tweet.username.toLowerCase() === username.toLowerCase()
        );

        return NextResponse.json(userTweets);
    } catch (error) {
        console.error('Error fetching tweets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tweets' },
            { status: 500 }
        );
    }
}

