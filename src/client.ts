import { Interface } from 'ethers';
import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import process from 'node:process';
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';
import axios from 'axios';

async function main(args: string[]) {
    // fire up a webserver on a random port, this will be used to receive webhook
    // messages back from the subscription server
    const server = fastify()
    server.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const {
            blockNumber,
            returnValue
        } = request.body as any;

        const decoded = iface.decodeFunctionResult('getReserves', returnValue);
        console.log(`[${blockNumber}] reserve0: ${decoded.reserve0}\treserve1: ${decoded.reserve1}`);
    });

    const callbackAddress = await server.listen();


    const contractAddy = '0x2cc846fff0b08fb3bffad71f53a60b4b6e6d6482';
    const iface = new Interface(IUniswapV2Pair.abi);
    const data = iface.encodeFunctionData('getReserves')

    const subscriptionEndpoint = 'http://localhost:1999/subscribe';

    try {
        axios.request({
            method: 'post',
            url: subscriptionEndpoint,
            data: {
                callback: callbackAddress,
                address: contractAddy,
                data
            },
        })
    } catch (e) {
        // TODO: cleanup stale clients
        console.warn(e);
    }
}


const args = process.argv.slice(2);

main(args).catch((e) => {
    console.error(e);
    process.exit(1);
})
