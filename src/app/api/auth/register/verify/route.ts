import { verifyRegistrationResponse } from '@simplewebauthn/server';
import {
    getCurrentChallenge,
    storeUserCredential
} from '@/lib/redis';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

const rpID = new URL(process.env.NEXT_PUBLIC_API_URL || "").hostname;
let origin = process.env.NEXT_PUBLIC_API_URL || "";

if (!origin.endsWith('/')) {
    origin += '/'
}


export async function POST(req: Request) {
    try {
        const body = await req.json();
        const response = body.verification
        const userId = body.userId
        const email = body.email

        // Validate email
        if (!email || !email.includes('@')) {
            return new Response(JSON.stringify({
                error: 'Valid email is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get challenge from Redis
        const expectedChallenge = await getCurrentChallenge(userId);
        if (!expectedChallenge) {
            return new Response(JSON.stringify({
                error: 'Challenge not found or expired'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        console.log(response);
        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });

        if (verification.verified && verification.registrationInfo) {
            const { credential } = verification.registrationInfo;
            await storeUserCredential(userId, {
                credentialID: credential.id,
                publicKey: isoBase64URL.fromBuffer(credential.publicKey),
                counter: 0,
                email, // Store email with the credential
            });

            return new Response(JSON.stringify({
                verified: true,
                registrationInfo: verification.registrationInfo,
                email, // Include email in response
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            error: 'Verification failed'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Verification error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to verify registration',
            details: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
