import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { GenerateAuthenticationOptionsOpts } from '@simplewebauthn/server';
import {
    getUserCredentials,
    storeCurrentChallenge,
    getUserIdFromUsername
} from '@/lib/redis';

const rpID = new URL(process.env.NEXT_PUBLIC_API_URL || "").hostname;

export async function POST(req: Request) {
    try {
        const { username } = await req.json();

        // Get userId from username
        const userId = await getUserIdFromUsername(username);
        if (!userId) {
            return new Response(JSON.stringify({
                error: 'username not registered'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        console.log(`username: ${username}, found userId: ${userId}`);
        const userCredentials = await getUserCredentials(userId);

        if (userCredentials.length === 0) {
            return new Response(JSON.stringify({
                error: 'No registered credentials found for this user'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const opts: GenerateAuthenticationOptionsOpts = {
            timeout: 60000,
            allowCredentials: userCredentials.map(cred => ({
                id: cred.credentialID,
                type: 'public-key' as const,
                transports: ['internal'] as AuthenticatorTransport[],
            })),
            userVerification: 'preferred',
            rpID,
        };

        const options = await generateAuthenticationOptions(opts);
        await storeCurrentChallenge(userId, options.challenge);

        return new Response(JSON.stringify({
            options,
            userId // Return userId for use in verification
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('WebAuthn authentication error:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Failed to generate authentication options'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
