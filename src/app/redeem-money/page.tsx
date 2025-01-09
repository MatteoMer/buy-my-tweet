'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { ReclaimProofRequest, verifyProof } from '@reclaimprotocol/js-sdk';
import { startAuthentication } from '@simplewebauthn/browser';

interface Tweet {
    id: string;
    content: string;
    username: string;
    claimableAmount: number;
    isVerified: boolean;
}

interface UserDetails {
    username: string;
}

export default function RedeemMoneyPage() {
    const router = useRouter();
    const [tweets, setTweets] = useState<Tweet[]>([]);
    const [selectedTweet, setSelectedTweet] = useState<Tweet | null>(null);
    const [requestUrl, setRequestUrl] = useState('');
    const [userDetails, setUserDetails] = useState<UserDetails>({
        username: '',
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [isClaimProcessing, setIsClaimProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [claimError, setClaimError] = useState<string | null>(null);
    const [userDetailsError, setUserDetailsError] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const fetchTweets = async () => {
            if (!userDetails.username) return;

            try {
                const response = await fetch(`/api/tweets-to-verify?username=${encodeURIComponent(userDetails.username)}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch tweets');
                }
                const data = await response.json();
                setTweets(data);
            } catch (error) {
                console.error('Error fetching tweets:', error);
                setError('Failed to load tweets');
            }
        };

        if (isAuthenticated) {
            fetchTweets();
        }
    }, [isAuthenticated, userDetails.username]);

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

    const startVerification = async (tweet: Tweet) => {
        if (!isAuthenticated) {
            setError('Please authenticate first');
            return;
        }

        setSelectedTweet(tweet);

        try {
            setError(null);
            setIsProcessing(true);
            setRequestUrl('');

            const response = await fetch('/api/reclaim/generate?app=post');
            const jsonData = await response.json();

            if (!jsonData.reclaimProofRequestConfig) {
                throw new Error('Failed to get proof request configuration');
            }

            const reclaimProofRequest = await ReclaimProofRequest.fromJsonString(
                jsonData.reclaimProofRequestConfig
            );

            const url = await reclaimProofRequest.getRequestUrl();
            setRequestUrl(url);

            await reclaimProofRequest.startSession({
                onSuccess: async (proof) => {
                    if (proof && typeof proof !== 'string') {
                        console.log(JSON.stringify(proof))
                        const isProofVerified = await verifyProof(proof);

                        if (isProofVerified) {
                            await fetch('/api/reclaim/receive-proof', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ proof, tweetId: tweet.id }),
                            });

                            setTweets(prevTweets =>
                                prevTweets.map(t =>
                                    t.id === tweet.id ? { ...t, isVerified: true } : t
                                )
                            );
                        }
                    }
                    setIsProcessing(false);
                    setSelectedTweet(null);
                    handleClaim(tweet)
                },
                onError: (error) => {
                    console.error('Verification failed', error);
                    setError('Verification failed');
                    setIsProcessing(false);
                    setSelectedTweet(null);
                },
            });
        } catch (error) {
            console.error('Error during verification request:', error);
            setError('Failed to start verification');
            setIsProcessing(false);
            setSelectedTweet(null);
        }
    };

    const handleClaim = async (tweet: Tweet) => {
        try {
            setIsClaimProcessing(true);
            setClaimError(null);

            const response = await fetch('/api/claim', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: tweet.username,
                    amount: tweet.claimableAmount,
                    tweetId: tweet.id
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to claim reward');
            }

            setTweets(prevTweets => prevTweets.filter(t => t.id !== tweet.id));
            alert('Reward claimed successfully!');

        } catch (error) {
            console.error('Error claiming reward:', error);
            setClaimError(error instanceof Error ? error.message : 'Failed to claim reward');
        } finally {
            setIsClaimProcessing(false);
        }
    };

    return (
        <div>
            <button onClick={() => router.push('/')}>Back to Home</button>

            <h1>Redeem your money</h1>

            {error && <div>Error: {error}</div>}

            <form onSubmit={handleUserDetailsSubmit}>
                <div>
                    <label htmlFor="username">Username:</label>
                    <input
                        type="text"
                        id="username"
                        value={userDetails.username}
                        onChange={(e) => setUserDetails(prev => ({ ...prev, username: e.target.value }))}
                        required
                    />
                    <button type="submit" disabled={isAuthenticating}>
                        {isAuthenticating ? 'Authenticating...' : 'Authenticate'}
                    </button>
                </div>
                {userDetailsError && <div>{userDetailsError}</div>}
            </form>

            {isAuthenticated && (
                <div>
                    <h2>Your Tweets to claim</h2>
                    {tweets.length === 0 ? (
                        <p>No tweets to claim</p>
                    ) : (
                        <div>
                            {tweets.map(tweet => (
                                <div key={tweet.id}>
                                    <p>Tweet: {tweet.content}</p>
                                    <p>Username: {tweet.username}</p>
                                    <p>Claimable Amount: {tweet.claimableAmount} USDC</p>
                                    {!tweet.isVerified ? (
                                        <button
                                            onClick={() => startVerification(tweet)}
                                            disabled={isProcessing && selectedTweet?.id === tweet.id}
                                        >
                                            {isProcessing && selectedTweet?.id === tweet.id
                                                ? 'Claiming...'
                                                : 'Claim'}
                                        </button>
                                    ) : (
                                        <div>
                                            <p>Verified ✓</p>
                                            <button
                                                onClick={() => handleClaim(tweet)}
                                                disabled={isClaimProcessing}
                                            >
                                                {isClaimProcessing ? 'Claiming...' : 'Claim Reward'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {requestUrl && selectedTweet && (
                        <div>
                            <h3>Scan QR Code to Verify</h3>
                            <QRCode value={requestUrl} />
                            <p>Please scan this QR code with your phone to verify your tweet</p>
                        </div>
                    )}
                </div>
            )}

            {claimError && <div>Error: {claimError}</div>}
        </div>
    );
}
