'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';

interface User {
    id: number;
    name: string;
    username: string;
    price: number;
}

export default function BuyTweetPage() {
    const router = useRouter();
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [tweetText, setTweetText] = useState<string>('');
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [userDetails, setUserDetails] = useState({ username: '' });
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userDetailsError, setUserDetailsError] = useState<string | null>(null);
    const [isFaucetLoading, setIsFaucetLoading] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            fetchUsers();
        }
    }, [isAuthenticated]);

    const handleFaucet = async () => {
        if (!isAuthenticated || !userDetails.username) {
            setError('Please authenticate first');
            return;
        }

        setIsFaucetLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/faucet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: `${userDetails.username}.simple-identity`
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to call faucet');
            }

            alert('Faucet called successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to call faucet');
        } finally {
            setIsFaucetLoading(false);
        }
    };

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

    const handleWebAuthnLogin = async () => {
        try {
            if (!userDetails.username || userDetails.username.length < 3) {
                setUserDetailsError('Please enter a valid username to login');
                return;
            }
            setIsAuthenticating(true);
            setError(null);

            const optionsRes = await fetch('/api/auth/webauthn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: userDetails.username })
            });

            if (!optionsRes.ok) {
                throw new Error((await optionsRes.json()).error || 'Failed to get authentication options');
            }

            const options = await optionsRes.json();
            const credential = await startAuthentication({ optionsJSON: options.options });

            const verificationRes = await fetch('/api/auth/webauthn/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ credential, username: userDetails.username }),
            });

            if (!verificationRes.ok) {
                throw new Error('Failed to verify authentication');
            }

            const verification = await verificationRes.json();
            if (verification.verified) {
                setIsAuthenticated(true);
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Authentication failed');
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleUserDetailsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setUserDetailsError(null);

        if (!userDetails.username) {
            setUserDetailsError('Please fill in all fields');
            return;
        }
        handleWebAuthnLogin();
    };

    const handleUserClick = (user: User) => {
        if (!isAuthenticated) {
            setError('Please authenticate first');
            return;
        }
        setSelectedUser(user);
        setTweetText('');
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isAuthenticated) {
            setError('Please authenticate first');
            return;
        }

        if (!selectedUser || !tweetText.trim()) {
            setError('Please select a user and enter tweet text');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/buy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user: `${userDetails.username}.simple-identity`,
                    amount: Number(selectedUser.price),
                    message: tweetText,
                    receiver: `${selectedUser.username}`,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to buy tweet');
            }

            alert('Tweet purchased successfully!');
            router.push('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to buy tweet');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && isAuthenticated) {
        return <div className="p-4">Loading users...</div>;
    }

    return (
        <div className="p-4">
            <div className="mb-4 flex justify-between items-center">
                <button
                    onClick={() => router.push('/')}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                    Back to Home
                </button>

                {isAuthenticated && (
                    <button
                        onClick={handleFaucet}
                        disabled={isFaucetLoading}
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                    >
                        {isFaucetLoading ? 'Calling Faucet...' : 'Get Tokens'}
                    </button>
                )}
            </div>

            <h1 className="text-2xl font-bold mb-6">Buy a Tweet</h1>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {!isAuthenticated ? (
                <form onSubmit={handleUserDetailsSubmit} className="mb-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                Username:
                            </label>
                            <input
                                type="text"
                                id="username"
                                value={userDetails.username}
                                onChange={(e) => setUserDetails(prev => ({ ...prev, username: e.target.value }))}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isAuthenticating}
                            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                            {isAuthenticating ? 'Authenticating...' : 'Authenticate'}
                        </button>
                    </div>
                    {userDetailsError && (
                        <div className="mt-2 text-red-600 text-sm">
                            {userDetailsError}
                        </div>
                    )}
                </form>
            ) : (
                <>
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold mb-3">Select a User</h2>
                        <ul className="space-y-2">
                            {users.map(user => (
                                <li
                                    key={user.id}
                                    onClick={() => handleUserClick(user)}
                                    className={`p-3 rounded cursor-pointer hover:bg-gray-100 ${selectedUser?.id === user.id ? 'bg-blue-100' : ''}`}
                                >
                                    {user.name} ({user.username}) - ${user.price.toFixed(2)}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {selectedUser && (
                        <div>
                            <h2 className="text-xl font-semibold mb-3">
                                Buy Tweet from {selectedUser.name} - ${selectedUser.price.toFixed(2)}
                            </h2>
                            <form onSubmit={handleSubmit}>
                                <div className="mb-4">
                                    <textarea
                                        value={tweetText}
                                        onChange={(e) => setTweetText(e.target.value)}
                                        placeholder="Enter the tweet you want to buy..."
                                        rows={3}
                                        className="w-full p-2 border rounded focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {submitting ? 'Processing...' : `Buy Tweet ($${selectedUser.price.toFixed(2)})`}
                                </button>
                            </form>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
