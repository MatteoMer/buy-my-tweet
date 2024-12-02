export const clients = new Set<ReadableStreamDefaultController>();

export async function sendEventToClients(data: any) {
    clients.forEach(client => {
        try {
            const encoder = new TextEncoder();
            client.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (error) {
            console.error('Error sending to client:', error);
            client.close();
            clients.delete(client);
        }
    });
}
