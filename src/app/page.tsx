'use client'
import { useRouter } from 'next/navigation';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { useState } from 'react';

const Home = () => {
    const router = useRouter();
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleNavigation = (path: string) => {
        router.push(path);
    };

    const handleRegister = async () => {
        try {
            setIsAuthenticating(true);
            setError(null);

            const optionsRes = await fetch('/api/auth/register', {
                method: 'POST',
            });

            if (!optionsRes.ok) {
                throw new Error('Failed to get registration options');
            }

            const { options, userId } = await optionsRes.json();
            localStorage.setItem('webauthn_user_id', userId);

            const verification = await startRegistration({ optionsJSON: options });

            const verificationRes = await fetch('/api/auth/register/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ verification, userId }),
            });

            if (!verificationRes.ok) {
                throw new Error('Failed to verify registration');
            }

            const result = await verificationRes.json();

            if (result.verified) {
                alert('Successfully registered biometric authentication!');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setIsAuthenticating(false);
        }
    };
    const handleWebAuthnLogin = async () => {
        try {
            setIsAuthenticating(true);
            setError(null);

            const userId = localStorage.getItem('webauthn_user_id');
            console.log(`userId: ${userId}`)

            const optionsRes = await fetch('/api/auth/webauthn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId })
            });

            if (!optionsRes.ok) {
                throw new Error('Failed to get authentication options');
            }


            const options = await optionsRes.json();
            const credential = await startAuthentication(options);

            const verificationRes = await fetch('/api/auth/webauthn/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credential),
            });

            if (!verificationRes.ok) {
                throw new Error('Failed to verify authentication');
            }

            const verification = await verificationRes.json();

            if (verification.verified) {
                router.push('/buy-tweet');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Authentication failed');
        } finally {
            setIsAuthenticating(false);
        }
    };

    return (
        <div>
            <h1>Buy a X post</h1>
            {error && (
                <div>
                    {error}
                </div>
            )}
            <div>
                <button
                    disabled={isAuthenticating}
                    onClick={handleRegister}
                >
                    {isAuthenticating ? 'Registering...' : 'Register Device'}
                </button>

                <br></br>
                <button
                    disabled={isAuthenticating}
                    onClick={handleWebAuthnLogin}
                >
                    {isAuthenticating ? 'Authenticating...' : 'Login with Device'}
                </button>
                <br></br>
                <br></br>


                <button onClick={() => handleNavigation('/buy-tweet')}>
                    Buy Tweet
                </button>

                <button onClick={() => handleNavigation('/redeem-money')}>
                    Redeem Money
                </button>
            </div>
        </div>
    );
};

export default Home;
