import { Redis } from '@upstash/redis'

interface StoredCredential {
    credentialID: string;  // Base64 encoded
    publicKey: string;     // Base64 encoded
    counter: number;
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

    return await redis.set(key, JSON.stringify(existingCredentials));
}

export async function getUserCredentials(userId: string): Promise<StoredCredential[]> {
    const key = `webauthn:user:${userId}:credentials`;
    const stored = await redis.get<string>(key);
    return stored ? JSON.parse(stored) : [];
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
    const updatedCredentials = credentials.filter(cred => cred.credentialID !== credentialId);
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
