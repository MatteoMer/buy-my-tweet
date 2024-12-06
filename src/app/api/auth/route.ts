import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type {
    GenerateAuthenticationOptionsOpts,
} from '@simplewebauthn/server';

const rpID = new URL(process.env.NEXT_PUBLIC_API_URL || "").hostname;
const origin = process.env.NEXT_PUBLIC_API_URL || "";

export async function POST(req: Request) {
    try {
        const opts: GenerateAuthenticationOptionsOpts = {
            timeout: 60000,
            allowCredentials: [],
            // You'll need to populate this with stored credentials
            userVerification: 'preferred',
            rpID,
        };

        const options = await generateAuthenticationOptions(opts);

        return new Response(JSON.stringify(options), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to generate authentication options' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
