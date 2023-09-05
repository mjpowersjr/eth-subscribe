import fastify, { FastifyReply, FastifyRequest } from 'fastify';

export interface CallbackBody {
    blockNumber: string;
    returnValue: string;
}

export class EmbeddedWebhookServer {

    static async launch({
        handleWebhook,
        port,
    }: {
        handleWebhook: (body: CallbackBody) => any;
        port?: number;
    }) {
        // setup a simple webserver listening for webhook messages to be sent back
        const server = fastify()
        server.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
            await handleWebhook(request.body as CallbackBody);
        });

        const callbackAddress = await server.listen({
            port,
        });

        return { 
            server,
            callbackAddress,
        }
    }

}
