
// Store for connected clients
const clients = new Set<WritableStreamDefaultWriter<Uint8Array>>();

export async function GET() {
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    clients.add(writer);

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
            clients.delete(writer);
            writer.close();
        }
    }, 30000);

    return response;
}

// Helper function to send data to all connected clients
export async function sendEventToClients(data: any) {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

    for (const writer of clients) {
        try {
            await writer.write(encodedData);
        } catch (error) {
            console.error('Error sending to client:', error);
            clients.delete(writer);
            writer.close();
        }
    }
}
