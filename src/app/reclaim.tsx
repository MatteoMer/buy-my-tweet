'use client'
import { useState } from 'react';
import QRCode from 'react-qr-code';
import { ReclaimProofRequest, verifyProof } from '@reclaimprotocol/js-sdk';

function ReclaimDemo() {
    const [requestUrl, setRequestUrl] = useState('');
    const [proofs, setProofs] = useState([]);
    const [username, setUsername] = useState('')
    const [post, setPost] = useState('')
    const [date, setDate] = useState('')

    const getVerificationReq = async () => {
        try {
            setProofs([]);

            // Fetch the configuration from our backend
            const response = await fetch('/api/reclaim/generate');
            const jsonData = await response.json();

            if (!jsonData.reclaimProofRequestConfig) {
                throw new Error('Failed to get proof request configuration');
            }

            // Initialize the Reclaim SDK with the configuration from backend
            const reclaimProofRequest = await ReclaimProofRequest.fromJsonString(
                jsonData.reclaimProofRequestConfig
            );

            // Generate the verification request URL
            const requestUrl = await reclaimProofRequest.getRequestUrl();
            console.log('Request URL:', requestUrl);
            setRequestUrl(requestUrl);

            // Start listening for proof submissions
            await reclaimProofRequest.startSession({
                onSuccess: async (proofs) => {
                    if (proofs) {
                        if (typeof proofs === 'string') {
                            console.log('SDK Message:', proofs);
                            setProofs([proofs]);
                        } else if (typeof proofs !== 'string') {
                            console.log('Verification success', proofs?.claimData.context);
                            const context = JSON.parse(proofs?.claimData.context);
                            const params = context.extractedParameters;

                            setUsername(params.screen_name);
                            setPost(params.full_text);
                            setDate(params.created_at);

                            const isProofVerified = await verifyProof(proofs);
                            if (!isProofVerified) {
                                console.error('Proof verification failed');
                                setUsername('Verification Failed');
                            }

                            // Send proofs to backend for processing
                            await fetch('/api/reclaim/receive-proofs', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(proofs),
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
