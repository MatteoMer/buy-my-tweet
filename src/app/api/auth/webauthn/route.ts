import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { GenerateAuthenticationOptionsOpts } from '@simplewebauthn/server';
import { getUserCredentials, storeCurrentChallenge } from '@/lib/redis';

const rpID = new URL(process.env.NEXT_PUBLIC_API_URL || "").hostname; // This will get 'localhost'

export async function POST(req: Request) {
    try {

        const res = await req.json()
        const userId = res["userId"]

        console.log(`userId webauthn route: ${userId}`)
        const userCredentials = await getUserCredentials(userId);

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

        return new Response(JSON.stringify(options), {
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

