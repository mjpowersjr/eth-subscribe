import ERC20ABI from '../src/abi/ERC20ABI.json';
import { Interface } from 'ethers';
import process from 'node:process';
import { CallbackBody, EmbeddedWebhookServer } from '../src/client/EmbeddedWebhookServer';
import { EthSubscribeClient } from '../src/client/EthSubscribeClient';

async function main(args: string[]) {
    // setup eth_call request 
    const contractAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const tokenHolder = '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1';

    const iface = new Interface(ERC20ABI);
    const data = iface.encodeFunctionData('balanceOf', [tokenHolder]);

    // handle incoming webhook messages
    function handleWebhook({
        blockNumber,
        returnValue,
    }: CallbackBody) {
        const decoded = iface.decodeFunctionResult('balanceOf', returnValue);
        console.log(`[${blockNumber}]\tbalanceOf: ${decoded}`);
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
