'use client';
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    id: number;
    name: string;
    username: string;
}

export default function BuyTweetPage() {
    const router = useRouter();
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [tweetText, setTweetText] = useState<string>('');
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users');
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            const data = await response.json();
            setUsers(data.users);
            setLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch users');
            setLoading(false);
        }
    };

    const handleUserClick = (user: User) => {
        setSelectedUser(user);
        setTweetText('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // This is where the buying logic would go
        console.log(`Buying tweet from ${selectedUser?.username}: ${tweetText}`);
    };

    if (loading) {
        return <div>Loading users...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div>
            <div>
                <button onClick={() => router.push('/')}>Back to Home</button>
            </div>

            <h1>Buy a Tweet</h1>

            <div>
                <h2>Select a User</h2>
                <ul>
                    {users.map(user => (
                        <li
                            key={user.id}
                            onClick={() => handleUserClick(user)}
                            style={{ cursor: 'pointer' }}
                        >
                            {user.name} ({user.username})
                        </li>
                    ))}
                </ul>
            </div>

            {selectedUser && (
                <div>
                    <h2>Buy Tweet from {selectedUser.name}</h2>
                    <form onSubmit={handleSubmit}>
                        <div>
                            <textarea
                                value={tweetText}
                                onChange={(e) => setTweetText(e.target.value)}
                                placeholder="Enter the tweet you want to buy..."
                                rows={3}
                            />
                        </div>
                        <button type="submit">Buy Tweet</button>
                    </form>
                </div>
            )}
        </div>
    );
}