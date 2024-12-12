import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import {
    getUserCredentials,
    getCurrentChallenge,
    updateCredentialCounter,
    getUserIdFromUsername
} from '@/lib/redis';

const rpID = new URL(process.env.NEXT_PUBLIC_API_URL || "").hostname;
const origin = process.env.NEXT_PUBLIC_API_URL || "";

export async function POST(req: Request) {
    try {
        const { credential, username } = await req.json();


        const userId = await getUserIdFromUsername(username);
        if (!userId) {
            return new Response(JSON.stringify({
                error: 'username not registered'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const userCredentials = await getUserCredentials(userId);
        const storedCredential = userCredentials.find(cred => cred.credentialID === credential.id);

        if (!storedCredential) {
            throw new Error('Credential not found');
        }

        const expectedChallenge = await getCurrentChallenge(userId);
        if (!expectedChallenge) {
            throw new Error('Challenge not found');
        }

        const verification = await verifyAuthenticationResponse({
            response: credential,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
                id: storedCredential.credentialID,
                publicKey: isoBase64URL.toBuffer(storedCredential.publicKey),
                counter: storedCredential.counter,
                transports: ['internal']
            },
            requireUserVerification: true,
        });

        if (verification.verified) {
            await updateCredentialCounter(
                userId,
                storedCredential.credentialID,
                verification.authenticationInfo.newCounter
            );
        }

        return new Response(JSON.stringify({
            verified: verification.verified,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('WebAuthn verification error:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Failed to verify authentication'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
