import { Redis } from '@upstash/redis'

interface StoredCredential {
    credentialID: string;
    publicKey: string;
    counter: number;
    email: string;
}

export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function storeProof(proofData: any) {
    await redis.set('latest_proof', JSON.stringify({
        ...proofData,
        timestamp: Date.now()
    }));
}

export async function getLatestProof() {
    return await redis.get('latest_proof');
}

export async function clearProof() {
    return await redis.del('latest_proof');
}

export async function storeUserCredential(userId: string, credential: StoredCredential) {
    const key = `webauthn:user:${userId}:credentials`;
    const existingCredentials = await getUserCredentials(userId);

    // Add new credential to existing ones
    existingCredentials.push(credential);

    await storeEmailMapping(credential.email, userId);

    return await redis.set(key, JSON.stringify(existingCredentials));
}

export async function getUserCredentials(userId: string): Promise<StoredCredential[]> {
    const key = `webauthn:user:${userId}:credentials`;
    const stored = await redis.get<StoredCredential[]>(key);
    console.log(typeof stored)
    return stored || [];
}

export async function storeCurrentChallenge(userId: string, challenge: string) {
    const key = `webauthn:user:${userId}:challenge`;
    // Store challenge with 5-minute expiration
    return await redis.set(key, JSON.stringify(challenge), { ex: 300 });
}

export async function getCurrentChallenge(userId: string): Promise<string | null> {
    const key = `webauthn:user:${userId}:challenge`;
    return await redis.get(key);
}

export async function removeUserCredential(userId: string, credentialId: string) {
    const key = `webauthn:user:${userId}:credentials`;
    const credentials = await getUserCredentials(userId);

    const credentialToRemove = credentials.find(cred => cred.credentialID === credentialId);
    const updatedCredentials = credentials.filter(cred => cred.credentialID !== credentialId);

    // If this was the last credential for this email, remove the email mapping
    if (credentialToRemove && updatedCredentials.length === 0) {
        await removeEmailMapping(credentialToRemove.email);
    }
    return await redis.set(key, JSON.stringify(updatedCredentials));
}

export async function updateCredentialCounter(userId: string, credentialId: string, newCounter: number) {
    const key = `webauthn:user:${userId}:credentials`;
    const credentials = await getUserCredentials(userId);
    const updatedCredentials = credentials.map(cred =>
        cred.credentialID === credentialId
            ? { ...cred, counter: newCounter }
            : cred
    );
    return await redis.set(key, JSON.stringify(updatedCredentials));
}


export async function storeEmailMapping(email: string, userId: string) {
    const key = `webauthn:email:${email}`;
    return await redis.set(key, userId);
}

export async function removeEmailMapping(email: string) {
    const key = `webauthn:email:${email}`;
    return await redis.del(key);
}

export async function getUserIdFromEmail(email: string): Promise<string | null> {
    const key = `webauthn:email:${email}`;
    return await redis.get(key);
}

export async function isEmailRegistered(email: string): Promise<boolean> {
    const userId = await getUserIdFromEmail(email);
    return userId !== null;
}

export async function getAllUserEmails(userId: string): Promise<string[]> {
    const credentials = await getUserCredentials(userId);
    return [...new Set(credentials.map(cred => cred.email))];
}
