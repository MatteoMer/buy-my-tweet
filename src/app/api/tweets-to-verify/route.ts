import { NextResponse } from 'next/server';

interface Tweet {
    id: string;
    content: string;
    username: string;
    claimableAmount: number;
    isVerified: boolean;
}

interface BuyMyTweetMessage {
    content: string;
    status: boolean;
}

interface BuyMyTweetUser {
    id: string;
    price: number;
    messages: BuyMyTweetMessage[];
}

interface ApiResponse {
    users: {
        [key: string]: BuyMyTweetUser;
    };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const username = `${searchParams.get('username')}.simple-identity`;

        // Check if username is provided
        if (!username) {
            return NextResponse.json(
                { error: 'Username is required' },
                { status: 400 }
            );
        }

        // Fetch data from the contract state API
        const response = await fetch(
            "http://127.0.0.1:8180/contracts/state?contractName=buy-my-tweet"
        );

        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }

        const data: ApiResponse = await response.json();
        let users = data.users

        console.log(Object.keys(data.users))
        console.log(username)


        // Transform the user's messages into tweets
        const tweets: Tweet[] = users[username].messages.map((message, index) => ({
            id: `${index + 1}`,
            content: message.content,
            username: username.split('.')[0],
            claimableAmount: users[username].price,
            isVerified: message.status
        }));

        return NextResponse.json(tweets);
    } catch (error) {
        console.error('Error fetching tweets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tweets' },
            { status: 500 }
        );
    }
}
