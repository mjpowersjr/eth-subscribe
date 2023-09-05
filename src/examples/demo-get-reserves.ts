import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';
import { Interface } from 'ethers';
import process from 'node:process';
import { CallbackBody, EmbeddedWebhookServer } from '../client/EmbeddedWebhookServer';
import { EthSubscribeClient } from '../client/EthSubscribeClient';

async function main(args: string[]) {
    // setup eth_call request 
    const contractAddress = '0x2cc846fff0b08fb3bffad71f53a60b4b6e6d6482';
    const iface = new Interface(IUniswapV2Pair.abi);
    const data = iface.encodeFunctionData('getReserves')

    // handle incoming webhook messages
    function handleWebhook({
        blockNumber,
        returnValue,
    }: CallbackBody) {
        const decoded = iface.decodeFunctionResult('getReserves', returnValue);
        console.log(`[${blockNumber}]\treserve0: ${decoded.reserve0}\treserve1: ${decoded.reserve1}`);
    }

    // setup a simple webserver listening for webhook messages to be sent back
    const {
        callbackAddress
    } = await EmbeddedWebhookServer.launch({ handleWebhook });

    // create a client, and register a new subscription
    const client = new EthSubscribeClient('http://localhost:1999');
    await client.subscribe({
        callback: callbackAddress,
        address: contractAddress,
        data
    });
}


const args = process.argv.slice(2);

main(args).catch((e) => {
    console.error(e);
    process.exit(1);
})
