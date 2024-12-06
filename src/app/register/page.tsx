'use client'
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

const RegisterPage = () => {
    const router = useRouter();
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [username, setUsername] = useState('');
    const [loginUsername, setLoginUsername] = useState('');
    const [price, setPrice] = useState('');

    useEffect(() => {
        setError('On this page you can register to get listed on the app')
    }, [])

    const handleRegister = async () => {
        try {
            if (!username || username.length < 3) {
                setError('Please enter a valid username (at least 3 characters)');
                return;
            }

            const priceNumber = Number(price);
            if (!price || isNaN(priceNumber) || priceNumber <= 0) {
                setError('Please enter a valid price (greater than 0)');
                return;
            }

            setIsAuthenticating(true);
            setError(null);

            const optionsRes = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, price: priceNumber }),
            });

            if (!optionsRes.ok) {
                const errorData = await optionsRes.json();
                throw new Error(errorData.error || 'Failed to get registration options');
            }

            const { options, userId } = await optionsRes.json();

            const verification = await startRegistration({ optionsJSON: options });

            const verificationRes = await fetch('/api/auth/register/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ verification, userId, username, price: priceNumber }),
            });

            if (!verificationRes.ok) {
                const errorData = await verificationRes.json();
                throw new Error(errorData.error || 'Failed to verify registration');
            }

            const result = await verificationRes.json();

            if (result.verified) {
                alert('Successfully registered user!');
                setUsername('');
                setPrice('');
            }
            router.push('/')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleWebAuthnLogin = async () => {
        try {
            if (!loginUsername || loginUsername.length < 3) {
                setError('Please enter a valid username to login');
                return;
            }

            setIsAuthenticating(true);
            setError(null);

            const optionsRes = await fetch('/api/auth/webauthn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: loginUsername })
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
                body: JSON.stringify({ credential, username: loginUsername }),
            });

            if (!verificationRes.ok) {
                throw new Error('Failed to verify authentication');
            }

            const verification = await verificationRes.json();

            if (verification.verified) {
                setLoginUsername('');
                router.push('/buy-tweet');
            }
        } catch (err) {
            console.log(err);
            setError(err instanceof Error ? err.message : 'Authentication failed');
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPrice(value);
    };

    return (
        <div>
            <div>
                <button onClick={() => router.push('/')}>Back to Home</button>
            </div>

            <h1>Buy my X post</h1>

            {error && (
                <div>{error}</div>
            )}

            <div>
                <h2>Register new user</h2>
                <div>
                    Your username:
                    <input
                        type="text"
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>
                <div>
                    Price of a tweet:
                    <input
                        type="text"
                        placeholder="Enter a price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                    />
                </div>
                <div>
                    <button
                        disabled={isAuthenticating}
                        onClick={handleRegister}
                    >
                        {isAuthenticating ? 'Registering...' : 'Register user'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
