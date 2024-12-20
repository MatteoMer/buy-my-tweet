'use client'
import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { ReclaimProofRequest, verifyProof } from '@reclaimprotocol/js-sdk';

function ReclaimDemo() {
    const [requestUrl, setRequestUrl] = useState('');
    const [proofs, setProofs] = useState<any[]>([])
    const [username, setUsername] = useState('')
    const [post, setPost] = useState('')
    const [date, setDate] = useState('')

    useEffect(() => {
        const eventSource = new EventSource('/api/callback');

        eventSource.onmessage = (event) => {
            const proof = JSON.parse(event.data);
            setProofs((currentProofs) => [...currentProofs, proof]);
        };

        eventSource.onerror = (error) => {
            console.error('EventSource failed:', error);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const getVerificationReq = async () => {
        try {
            setProofs([]);

            const response = await fetch('/api/reclaim/generate');
            const jsonData = await response.json();

            if (!jsonData.reclaimProofRequestConfig) {
                throw new Error('Failed to get proof request configuration');
            }

            const reclaimProofRequest = await ReclaimProofRequest.fromJsonString(
                jsonData.reclaimProofRequestConfig
            );

            const requestUrl = await reclaimProofRequest.getRequestUrl();
            console.log('Request URL:', requestUrl);
            setRequestUrl(requestUrl);

            await reclaimProofRequest.startSession({
                onSuccess: async (proof) => {
                    if (proof) {
                        if (typeof proof === 'string') {
                            console.log('SDK Message:', proof);
                        } else if (typeof proof !== 'string') {
                            console.log('Verification success', proof?.claimData.context);
                            const context = JSON.parse(proof?.claimData.context);
                            const params = context.extractedParameters;

                            setUsername(params.screen_name);
                            setPost(params.full_text);
                            setDate(params.created_at);

                            const isProofVerified = await verifyProof(proof);
                            if (!isProofVerified) {
                                console.error('Proof verification failed');
                                setUsername('Verification Failed');
                            }

                            // Send proof to backend for processing
                            await fetch('/api/reclaim/receive-proof', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(proof),
                            });
                        }
                    }
                },
                onError: (error) => {
                    console.error('Verification failed', error);
                },
            });
        } catch (error) {
            console.error('Error during verification request:', error);
        }
    };


    return (
        <>
            <button onClick={getVerificationReq}>Get Verification Request</button>
            {/* Display QR code when URL is available */}
            {requestUrl && proofs.length == 0 && (
                <div style={{ margin: '20px 0' }}>
                    <QRCode value={requestUrl} />
                </div>
            )}
            {username && post && (
                <div>
                    <h2>Verification Successful!</h2>
                    <h3>{username} posted on {date}: </h3>
                    <p>{post}</p>
                </div>
            )}
        </>
    );
}

export default ReclaimDemo;
