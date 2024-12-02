import { addClient, removeClient } from '../../utils/eventUtils';

export async function GET() {
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    addClient(writer);

    const response = new Response(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });

    // Keep connection alive
    const keepAlive = setInterval(async () => {
        try {
            await writer.write(encoder.encode('data: ping\n\n'));
        } catch {
            clearInterval(keepAlive);
            removeClient(writer);
            writer.close();
        }
    }, 30000);

    return response;
}
