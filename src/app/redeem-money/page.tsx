'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { ReclaimProofRequest, verifyProof } from '@reclaimprotocol/js-sdk';
import { startAuthentication } from '@simplewebauthn/browser';

interface VerificationState {
    isVerified: boolean;
    username: string;
    post: string;
    date: string;
    claimableAmount?: number;
}

interface UserDetails {
    username: string;
}

export default function RedeemMoneyPage() {
    const router = useRouter();
    const [requestUrl, setRequestUrl] = useState('');
    const [isPolling, setIsPolling] = useState(false);
    const [verificationState, setVerificationState] = useState<VerificationState>({
        isVerified: false,
        username: '',
        post: '',
        date: ''
    });
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
            console.log(err);
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

    const calculateClaimableAmount = async (proofData: { username: string; post: string; date: string }) => {
        try {
            const response = await fetch('/api/calculate-claim', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(proofData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to calculate claimable amount');
            }

            return data.amount;
        } catch (error) {
            console.error('Error calculating claimable amount:', error);
            throw error;
        }
    };

    const handleClaim = async () => {
        if (!verificationState.isVerified || !verificationState.claimableAmount) {
            alert('Please complete verification first');
            return;
        }

        if (userDetails.username.toLowerCase() !== verificationState.username.toLowerCase()) {
            setClaimError('Username does not match the verified tweet username');
            return;
        }

        try {
            setIsClaimProcessing(true);
            setClaimError(null);

            const response = await fetch('/api/claim', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: verificationState.username,
                    amount: verificationState.claimableAmount
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to claim reward');
            }

            alert('Reward claimed successfully!');
            router.push('/');

        } catch (error) {
            console.error('Error claiming reward:', error);
            setClaimError(error instanceof Error ? error.message : 'Failed to claim reward');
        } finally {
            setIsClaimProcessing(false);
        }
    };

    const startVerification = async () => {
        if (!isAuthenticated) {
            setError('Please authenticate first');
            return;
        }

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
            setIsPolling(true);

            await reclaimProofRequest.startSession({
                onSuccess: async (proof) => {
                    if (proof && typeof proof !== 'string') {
                        const isProofVerified = await verifyProof(proof);

                        if (isProofVerified) {
                            await fetch('/api/reclaim/receive-proof', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(proof),
                            });
                        } else {
                            setError('Verification failed');
                            setIsProcessing(false);
                            setIsPolling(false);
                        }
                    }
                },
                onError: (error) => {
                    console.error('Verification failed', error);
                    setError('Verification failed');
                    setIsProcessing(false);
                    setIsPolling(false);
                },
            });
        } catch (error) {
            console.error('Error during verification request:', error);
            setError('Failed to start verification');
            setIsProcessing(false);
            setIsPolling(false);
        }
    };

    useEffect(() => {
        let pollInterval: NodeJS.Timeout;

        if (isPolling) {
            pollInterval = setInterval(async () => {
                try {
                    const response = await fetch('/api/proof-status?app=post');
                    if (!response.ok) {
                        throw new Error('Failed to fetch status');
                    }

                    const data = await response.json();

                    if (data) {
                        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

                        if (parsedData.error) {
                            setError(parsedData.error);
                            setIsPolling(false);
                            setIsProcessing(false);
                            return;
                        }

                        if (parsedData.proof) {
                            const context = JSON.parse(parsedData.proof.claimData.context);
                            const params = context.extractedParameters;

                            try {
                                const claimableAmount = await calculateClaimableAmount({
                                    username: params.screen_name,
                                    post: params.full_text,
                                    date: params.created_at
                                });

                                setVerificationState({
                                    isVerified: true,
                                    username: params.screen_name,
                                    post: params.full_text,
                                    date: params.created_at,
                                    claimableAmount
                                });

                                setIsPolling(false);
                                setIsProcessing(false);
                                setRequestUrl('');
                            } catch (error) {
                                setError('Failed to calculate claimable amount');
                                setIsPolling(false);
                                setIsProcessing(false);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Polling error:', error);
                }
            }, 2000);
        }

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [isPolling]);

    return (
        <div>
            <button onClick={() => router.push('/')}>Back to Home</button>

            <h1>Claim Your Reward</h1>

            {error && (
                <div style={{ color: 'red' }}>
                    Error: {error}
                </div>
            )}

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
                    <button
                        type="submit"
                        disabled={isAuthenticating}
                    >
                        {isAuthenticating ? 'Authenticating...' : 'Authenticate'}
                    </button>
                </div>
                {userDetailsError && (
                    <div style={{ color: 'red' }}>
                        {userDetailsError}
                    </div>
                )}
            </form>

            {isAuthenticated && !verificationState.isVerified && (
                <div>
                    <h2>Verify Your Tweet</h2>
                    <button
                        onClick={startVerification}
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Processing...' : 'Start Verification'}
                    </button>

                    {requestUrl && !verificationState.isVerified && (
                        <div>
                            <h3>Scan QR Code to Verify</h3>
                            <QRCode value={requestUrl} />
                            <p>Please scan this QR code with your phone to verify your tweet</p>
                        </div>
                    )}
                </div>
            )}

            {verificationState.isVerified && (
                <div>
                    <h2>Verification Successful!</h2>
                    <div>
                        <h3>Tweet Details:</h3>
                        <p>Username: {verificationState.username}</p>
                        <p>Posted on: {verificationState.date}</p>
                        <p>Tweet content: {verificationState.post}</p>
                    </div>

                    {userDetails.username.toLowerCase() === verificationState.username.toLowerCase() ? (
                        <div>
                            <h3>Claimable Amount:</h3>
                            <p>{verificationState.claimableAmount} USDC</p>
                            <button
                                onClick={handleClaim}
                                disabled={isClaimProcessing}
                            >
                                {isClaimProcessing ? 'Processing...' : 'Claim Reward'}
                            </button>

                            {claimError && (
                                <div style={{ color: 'red' }}>
                                    Error: {claimError}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ color: 'red' }}>
                            <p>The username you entered does not match the verified tweet username. Please update your username to claim the reward.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
