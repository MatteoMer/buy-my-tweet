import { Redis } from '@upstash/redis'

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
