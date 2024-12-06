'use client'
import { useRouter } from 'next/navigation';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { useState } from 'react';


const Home = () => {
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [loginEmail, setLoginEmail] = useState('');

    const router = useRouter();

    const handleNavigation = (path: string) => {
        router.push(path);
    };

    const handleRegister = async () => {
        try {
            if (!email || !email.includes('@')) {
                setError('Please enter a valid email address');
                return;
            }

            setIsAuthenticating(true);
            setError(null);

            const optionsRes = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            if (!optionsRes.ok) {
                const errorData = await optionsRes.json();
                throw new Error(errorData.error || 'Failed to get registration options');
            }

            const { options, userId } = await optionsRes.json();
            localStorage.setItem('webauthn_user_id', userId);

            const verification = await startRegistration({ optionsJSON: options });

            const verificationRes = await fetch('/api/auth/register/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ verification, userId, email }),
            });

            if (!verificationRes.ok) {
                const errorData = await verificationRes.json();
                throw new Error(errorData.error || 'Failed to verify registration');
            }

            const result = await verificationRes.json();

            if (result.verified) {
                alert('Successfully registered biometric authentication!');
                setEmail('');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleWebAuthnLogin = async () => {
        try {
            if (!loginEmail || !loginEmail.includes('@')) {
                setError('Please enter a valid email address to login');
                return;
            }

            setIsAuthenticating(true);
            setError(null);

            const optionsRes = await fetch('/api/auth/webauthn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: loginEmail })
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
                body: JSON.stringify({ credential, email: loginEmail }),
            });

            if (!verificationRes.ok) {
                throw new Error('Failed to verify authentication');
            }

            const verification = await verificationRes.json();

            if (verification.verified) {
                setLoginEmail('');
                router.push('/buy-tweet');
            }
        } catch (err) {
            console.log(err);
            setError(err instanceof Error ? err.message : 'Authentication failed');
        } finally {
            setIsAuthenticating(false);
        }
    };

    return (
        <div >
            <h1>Buy a X post</h1>

            <div>
                <div >
                    <button style={{ marginRight: "4px" }} onClick={() => handleNavigation('/register')}>
                        Register
                    </button>
                    <button style={{ marginRight: "4px" }} onClick={() => handleNavigation('/buy-tweet')}>
                        Buy Tweet
                    </button>
                    <button onClick={() => handleNavigation('/redeem-money')}>
                        Redeem Money
                    </button>
                </div>
            </div>

        </div >
    );
};

export default Home;
