const clients = new Set<WritableStreamDefaultWriter<Uint8Array>>();

export function addClient(writer: WritableStreamDefaultWriter<Uint8Array>) {
    clients.add(writer);
}

export function removeClient(writer: WritableStreamDefaultWriter<Uint8Array>) {
    clients.delete(writer);
}

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
