import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth"; // You'll need to create this
import { storeCurrentChallenge } from '@/lib/redis';

const rpName = 'Buy X post';
const rpID = new URL(process.env.NEXT_PUBLIC_API_URL || "").hostname;

export async function POST(req: Request) {
    try {
        const userId = uuidv4();

        const encoder = new TextEncoder();

        const userIdBytes = encoder.encode(userId);

        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: userIdBytes,
            userName: userId,
            attestationType: 'direct',
            authenticatorSelection: {
                authenticatorAttachment: 'platform', // This specifies TouchID/FaceID
                requireResidentKey: true,
                residentKey: 'required',
                userVerification: 'required'
            },
            supportedAlgorithmIDs: [-7, -257],
            timeout: 60000,
            challenge: crypto.getRandomValues(new Uint8Array(32))
        });

        console.log(`userId: ${userId}`)
        await storeCurrentChallenge(userId, options.challenge);

        return new Response(JSON.stringify({
            options,
            userId, // Include userId at the same level
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
