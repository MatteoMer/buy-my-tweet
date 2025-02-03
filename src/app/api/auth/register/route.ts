import { generateRegistrationOptions } from '@simplewebauthn/server';
import { v4 as uuidv4 } from 'uuid';
import { getUserCredentials, getUserIdFromUsername, removeUserCredential, storeCurrentChallenge } from '@/lib/redis';
import { Blob, BlobTransaction, HyleUtils } from '@/lib/hyle';

const HYLE_NODE_URL = process.env.HYLE_NODE_URL || 'http://localhost:4321'


const rpName = 'Buy X post';
const rpID = new URL(process.env.NEXT_PUBLIC_API_URL || "").hostname;

export async function POST(req: Request) {
    try {
        const { username, price } = await req.json();

        // TODO: verify reclaim proof

        /* HYLE */

        /*
        let blob: Blob = {
            contract_name: "buy-my-tweet-webauthn",
            data: [...new TextEncoder().encode(JSON.stringify({ username, price }))]
        };

        let blobTx: BlobTransaction = {
            identity: `${username}.buy-my-tweet-webauthn`,
            blobs: [blob]
        };

        console.log(blobTx)

        const response = await fetch(`${HYLE_NODE_URL}/v1/tx/send/blob`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(blobTx)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send blob transaction: ${errorText}`);
        }

        const txHash = await response.text();
        console.log(`txHash register: ${txHash}`)
        */

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
            //challenge: txHash
        });

        console.log(`userId: ${userId}, username: ${username}`);
        await storeCurrentChallenge(userId, options.challenge);

        console.log("options: " + JSON.stringify(options))

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
