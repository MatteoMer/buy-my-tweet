// app/redeem-money/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk';

interface VerificationState {
    isVerified: boolean;
    username: string;
    post: string;
    date: string;
    amount?: number;
}

interface ProofData {
    proof?: {
        claimData: {
            context: string;
        };
    };
    error?: string;
    status: number;
}

export default function RedeemMoneyPage() {
    const router = useRouter();
    const [requestUrl, setRequestUrl] = useState('');
    const [verificationState, setVerificationState] = useState<VerificationState>({
        isVerified: false,
        username: '',
        post: '',
        date: ''
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let pollInterval: NodeJS.Timeout;

        if (isProcessing) {
            pollInterval = setInterval(async () => {
                try {
                    const response = await fetch('/api/proof-status');
                    if (!response.ok) {
                        throw new Error('Failed to fetch status');
                    }

                    const data: ProofData = await response.json();

                    if (data.error) {
                        setError(data.error);
                        setIsProcessing(false);
                    } else if (data.proof) {
                        const context = JSON.parse(data.proof.claimData.context);
                        const params = context.extractedParameters;

                        // Here you would calculate or get the amount from your backend
                        const amount = 100; // Example amount

                        setVerificationState({
                            isVerified: true,
                            username: params.screen_name,
                            post: params.full_text,
                            date: params.created_at,
                            amount
                        });
                        setIsProcessing(false);
                        setError(null);
                    }
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'An error occurred');
                    setIsProcessing(false);
                }
            }, 2000); // Poll every 2 seconds
        }

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [isProcessing]);

    const startVerification = async () => {
        try {
            setIsProcessing(true);
            setError(null);

            const response = await fetch('/api/reclaim/generate');
            if (!response.ok) {
                throw new Error('Failed to generate verification request');
            }

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
                        await fetch('/api/reclaim/receive-proof', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(proof),
                        });
                    }
                },
                onError: (error) => {
                    console.error('Verification failed:', error);
                    setError('Verification failed');
                    setIsProcessing(false);
                },
            });
        } catch (error) {
            console.error('Error during verification request:', error);
            setError('Failed to start verification');
            setIsProcessing(false);
        }
    };

    const handleClaim = async () => {
        if (!verificationState.isVerified || !verificationState.amount) {
            setError('Verification required before claiming');
            return;
        }

        try {
            // Here you would implement the actual claim logic
            console.log(`Claiming ${verificationState.amount} USDC for ${verificationState.username}`);
            // Example:
            // await fetch('/api/claim', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ 
            //     username: verificationState.username,
            //     amount: verificationState.amount 
            //   })
            // });

            // Redirect to success page or show success message
            alert('Claim successful!');
            router.push('/');
        } catch (err) {
            setError('Failed to claim reward');
            console.error('Error claiming reward:', err);
        }
    };

    return (
        <div>
            <button onClick={() => router.push('/')}>Back to Home</button>

            <h1>Claim Your Reward</h1>

            {error && (
                <div>
                    Error: {error}
                </div>
            )}

            {!verificationState.isVerified ? (
                <div>
                    <h2>Verify Your Tweet</h2>
                    <button
                        onClick={startVerification}
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Processing...' : 'Start Verification'}
                    </button>

                    {requestUrl && isProcessing && (
                        <div>
                            <h3>Scan QR Code to Verify</h3>
                            <QRCode value={requestUrl} />
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <h2>Verification Successful!</h2>
                    <div>
                        <h3>Tweet Details:</h3>
                        <p>User: {verificationState.username}</p>
                        <p>Posted on: {verificationState.date}</p>
                        <p>Content: {verificationState.post}</p>
                    </div>

                    {verificationState.amount && (
                        <div>
                            <h3>Claimable Amount:</h3>
                            <p>{verificationState.amount} USDC</p>
                            <button onClick={handleClaim}>Claim Reward</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
