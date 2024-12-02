'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { ReclaimProofRequest, verifyProof } from '@reclaimprotocol/js-sdk';

interface VerificationState {
    isVerified: boolean;
    username: string;
    post: string;
    date: string;
    claimableAmount?: number;
}

interface ProofResponse {
    success: boolean;
    claimableAmount: number;
    tweetData: {
        screen_name: string;
        full_text: string;
        created_at: string;
    };
}

export default function RedeemMoneyPage() {
    const router = useRouter();
    const [requestUrl, setRequestUrl] = useState('');
    const [proofs, setProofs] = useState<any[]>([]);
    const [verificationState, setVerificationState] = useState<VerificationState>({
        isVerified: false,
        username: '',
        post: '',
        date: ''
    });
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const eventSource = new EventSource('/api/callback');

        eventSource.onmessage = (event) => {
            if (event.data === 'ping') return;

            try {
                const proofData: ProofResponse = JSON.parse(event.data);
                if (proofData.success) {
                    setVerificationState({
                        isVerified: true,
                        username: proofData.tweetData.screen_name,
                        post: proofData.tweetData.full_text,
                        date: proofData.tweetData.created_at,
                        claimableAmount: proofData.claimableAmount
                    });
                    setIsProcessing(false);
                }
            } catch (error) {
                console.error('Error parsing SSE data:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('EventSource failed:', error);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const startVerification = async () => {
        try {
            setIsProcessing(true);
            setProofs([]);

            const response = await fetch('/api/reclaim/generate');
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
                        const isProofVerified = await verifyProof(proof);

                        if (isProofVerified) {
                            // The verification state will be updated via SSE
                            await fetch('/api/reclaim/receive-proof', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(proof),
                            });
                        } else {
                            setVerificationState(prev => ({
                                ...prev,
                                username: 'Verification Failed'
                            }));
                            setIsProcessing(false);
                        }
                    }
                },
                onError: (error) => {
                    console.error('Verification failed', error);
                    setIsProcessing(false);
                },
            });
        } catch (error) {
            console.error('Error during verification request:', error);
            setIsProcessing(false);
        }
    };

    const handleClaim = async () => {
        if (!verificationState.isVerified || !verificationState.claimableAmount) {
            alert('Please complete verification first');
            return;
        }
        try {
            console.log(`Claiming amount: ${verificationState.claimableAmount} for user: ${verificationState.username}`);
            // Implement claim logic here
        } catch (error) {
            console.error('Error claiming reward:', error);
        }
    };

    // Rest of the component remains the same...
    return (
        <div>
            <button onClick={() => router.push('/')}>Back to Home</button>

            <h1>Claim Your Reward</h1>

            {!verificationState.isVerified && (
                <div>
                    <h2>Verify Your Tweet</h2>
                    <button
                        onClick={startVerification}
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Processing...' : 'Start Verification'}
                    </button>

                    {requestUrl && proofs.length === 0 && (
                        <div>
                            <h3>Scan QR Code to Verify</h3>
                            <QRCode value={requestUrl} />
                        </div>
                    )}
                </div>
            )}

            {verificationState.isVerified && (
                <div>
                    <h2>Verification Successful!</h2>
                    <div>
                        <h3>{verificationState.username} posted on {verificationState.date}:</h3>
                        <p>{verificationState.post}</p>
                    </div>

                    <div>
                        <h3>Claimable Amount:</h3>
                        <p>{verificationState.claimableAmount} USDC</p>
                        <button onClick={handleClaim}>Claim Reward</button>
                    </div>
                </div>
            )}
        </div>
    );
}
