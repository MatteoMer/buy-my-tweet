'use client'
import { useState } from 'react'

export default function BlobPage() {
    const [isProcessing, setIsProcessing] = useState(false)
    const [txHash, setTxHash] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleBlobTransaction = async () => {
        if (isProcessing) return
        setIsProcessing(true)
        setError(null)

        try {
            // Example proof data - replace with your actual proof
            const mockProof = {
                claim_data: {
                    context: JSON.stringify({
                        provider_hash: "test_hash",
                        extracted_parameters: {
                            // Your parameters here
                            test: "data"
                        }
                    })
                }
            };

            const response = await fetch('/api/hyle/blob', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    proof: mockProof
                })
            });

            if (!response.ok) {
                throw new Error('Failed to process blob transaction');
            }

            const data = await response.json();

            console.log('Transaction sent:', data.txHash);
            setTxHash(data.txHash);
        } catch (error) {
            console.error('Error processing blob transaction:', error);
            setError('Failed to process blob transaction');
        } finally {
            setIsProcessing(false)
        }
    };

    return (
        <div>
            <h1>Create Blob Transaction</h1>
            <div>
                <button
                    onClick={handleBlobTransaction}
                    disabled={isProcessing}
                >
                    {isProcessing ? 'Processing...' : 'Create Blob Transaction'}
                </button>
            </div>
            {error && (
                <div>
                    <p>Error: {error}</p>
                </div>
            )}
            {txHash && (
                <div>
                    <p>Blob transaction sent successfully!</p>
                    <p>Transaction Hash: {txHash}</p>
                </div>
            )}
            <div>
                <a href="/">Back to Home</a>
            </div>
        </div>
    );
}
