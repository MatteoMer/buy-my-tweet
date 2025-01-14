'use client'
import { useState } from 'react'

export default function ContractPage() {
    const [isRegistering, setIsRegistering] = useState(false)
    const [txHash, setTxHash] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleRegister = async () => {
        // Prevent duplicate submissions
        if (isRegistering) return

        // Reset state
        setIsRegistering(true)
        setError(null)

        try {
            const response = await fetch('/api/hyle/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contractName: 'reclaim-test',
                    guestId: '2d4c77912c40a3860f78ac71e81417cd666c08ebe678decf36012ef7fa8b83de',
                })
            });

            if (!response.ok) {
                throw new Error('Failed to register contract');
            }

            const data = await response.json();
            console.log('Contract registered:', data.txHash);
            setTxHash(data.txHash);
        } catch (error) {
            console.error('Error registering contract:', error);
            setError('Failed to register contract');
        } finally {
            setIsRegistering(false)
        }
    };

    return (
        <div>
            <h1>Register X Post Contract</h1>
            <div>
                <button
                    onClick={handleRegister}
                    disabled={isRegistering}
                >
                    {isRegistering ? 'Registering...' : 'Register Contract'}
                </button>
            </div>

            {error && (
                <div>
                    <p>Error: {error}</p>
                </div>
            )}

            {txHash && (
                <div>
                    <p>Contract registered successfully!</p>
                    <p>Transaction Hash: {txHash}</p>
                </div>
            )}

            <div>
                <a href="/">Back to Home</a>
            </div>
        </div>
    );
}

