import { generateRegistrationOptions } from '@simplewebauthn/server';
import { v4 as uuidv4 } from 'uuid';
import { getUserIdFromEmail, storeCurrentChallenge } from '@/lib/redis';

const rpName = 'Buy X post';
const rpID = new URL(process.env.NEXT_PUBLIC_API_URL || "").hostname;

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        // Validate email
        if (!email || !email.includes('@')) {
            return new Response(JSON.stringify({ error: 'Valid email is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const existingUserId = await getUserIdFromEmail(email);
        if (existingUserId) {
            return new Response(JSON.stringify({
                error: 'Email already registered'
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
            userName: email,
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

        console.log(`userId: ${userId}, email: ${email}`);
        await storeCurrentChallenge(userId, options.challenge);

        return new Response(JSON.stringify({
            options,
            userId,
            email,
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
