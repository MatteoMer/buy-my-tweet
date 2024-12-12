import { generateRegistrationOptions } from '@simplewebauthn/server';
import { v4 as uuidv4 } from 'uuid';
import { getUserCredentials, getUserIdFromUsername, removeUserCredential, storeCurrentChallenge } from '@/lib/redis';

const rpName = 'Buy X post';
const rpID = new URL(process.env.NEXT_PUBLIC_API_URL || "").hostname;

export async function POST(req: Request) {
    try {
        const { username } = await req.json();

        // TODO: verify reclaim proof

        const existingUserId = await getUserIdFromUsername(username);
        if (existingUserId) {
            // TODO remove
            const cred = await getUserCredentials(existingUserId)
            await removeUserCredential(existingUserId, cred[0].credentialID)
            return new Response(JSON.stringify({
                error: 'username already registered'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }


        const userId = uuidv4();
        const encoder = new TextEncoder();
        const userIdBytes = encoder.encode(userId);

        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: userIdBytes,
            userName: username,
            attestationType: 'direct',
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                requireResidentKey: true,
                residentKey: 'required',
                userVerification: 'required'
            },
            supportedAlgorithmIDs: [-7, -257],
            timeout: 60000,
            challenge: crypto.getRandomValues(new Uint8Array(32))
        });

        console.log(`userId: ${userId}, username: ${username}`);
        await storeCurrentChallenge(userId, options.challenge);

        return new Response(JSON.stringify({
            options,
            userId,
            username,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to generate registration options' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
