import { clients } from '../../utils/eventUtils';

export const runtime = 'edge';

export async function GET() {
    let controller: ReadableStreamDefaultController;
    const stream = new ReadableStream({
        start(ctrl) {
            controller = ctrl;
            clients.add(controller);
        },
        cancel() {
            clients.delete(controller);
        },
    });

    // Keep-alive interval
    const keepAlive = setInterval(() => {
        try {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('data: ping\n\n'));
        } catch {
            clearInterval(keepAlive);
            controller.close();
            clients.delete(controller);
        }
    }, 30000);

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
