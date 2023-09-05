import process from 'node:process';
import { Simulator } from './simulator/Simulator';
import * as redis from '@redis/client';
import { EthCallSubscription } from './EthCallSubscription';
import { CachingStateManager } from './simulator/CachingStateManager';
import { StorageSubscriptionManager } from './pubsub/StorageSubscriptionManager';
import { BlockTag, ethers } from 'ethers';
import { Interface } from '@ethersproject/abi';
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';
import { hexToBytes } from '@ethereumjs/util'
import { StorageManager } from './contract-storage/StorageManager';
import RedisClientMultiCommand from '@redis/client/dist/lib/client/multi-command';
import { EthereumProofFetcher } from './contract-storage/EthereumProofFetcher';
import { RedisClientFactory } from './RedisClientFactory';
import { EVMResult } from '@ethereumjs/evm';
import axios from 'axios';
import { bytesToHex } from '@ethereumjs/util';

import fastify, { FastifyReply, FastifyRequest } from 'fastify';

async function main(args: string[]) {

    const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/dbee8026e4154623b4711781185c3cc6')

    const subscriptionManager = new StorageSubscriptionManager({
        redisClient: await RedisClientFactory.getInstance(),
    });


    const proofFetcher = new EthereumProofFetcher({
        provider,
    });

    const storageManager = new StorageManager({
        redisClient: await RedisClientFactory.getInstance(),
        proofFetcher,
        subscriptionManager,
    });

    const server = fastify()
    server.post('/subscribe', async (request: FastifyRequest, reply: FastifyReply) => {
        console.log(request.body);

        const {
            callback,
            address,
            data
        } = request.body as any;

        const ethCallSubscription = new EthCallSubscription({
            provider,
            storageManager,
            redisClient: await RedisClientFactory.getInstance(),
            subscriptionManager,
            request: {
                address,
                data
            }
        });

        ethCallSubscription.on('update', async ({
            blockNumber,
            result
        }: {
            blockNumber: BlockTag;
            result: EVMResult
        }) => {

            console.log({

            })

            await axios.request({
                method: 'post',
                url: callback,
                data: {
                    blockNumber: '0x' + blockNumber.toString(16),
                    returnValue: bytesToHex(result.execResult.returnValue)
                }
            });

        })

        await ethCallSubscription.start();
    });
    server.listen({
        port: 1999
    });

    //////////
    // const contractAddress = '0x2cc846fff0b08fb3bffad71f53a60b4b6e6d6482';
    // const iface = new Interface(IUniswapV2Pair.abi);
    // const data = iface.encodeFunctionData('getReserves')
    // const blockTag = await provider.getBlockNumber();


    // function summarizeResults({ blockNumber, result }: { blockNumber: BlockTag; result: EVMResult }) {
    //     const decoded = iface.decodeFunctionResult('getReserves', result.execResult.returnValue);
    //     console.log(`[${blockNumber}] reserve0: ${decoded.reserve0}\treserve1: ${decoded.reserve1}`);
    // }

    // const result = await ethCallSubscription.executeAt(BigInt(blockTag));
    // summarizeResults({ blockNumber: blockTag, result });
    // FIXME: call init

    // ethCallSubscription.on('update', (updates) => {
    //     summarizeResults(updates);
    // })


    provider.on('block', async (blockNumber) => {
        // console.log('-'.repeat(80))
        // console.log(`| updating for block: ${blockNumber}`)
        // console.log('-'.repeat(80))
        try {
            await storageManager.update(blockNumber);
        } catch (e) {
            console.error(e);
        }
    });

    // const returnValue = iface.decodeFunctionResult('getReserves', result.execResult.returnValue);

    // // console.log({
    // //     result,
    // //     returnValue,
    // // })


    // https://github.com/ethereum/EIPs/issues/781
    // https://blog.infura.io/post/how-to-use-ethereum-proofs-2
    // for a given eth_call txn
    // run once at latest block, spy on getStorage access
    // update redis cache w. latest results
    // setup subscriptions to each storage address

    // on new block, get storage for all subscriptions
    // update redis cache
    // publish updates on redis channel - the channels will be <contract>:<key> - message will be blockNumber
    // listeners should run at-most once per block update, may need a lock etc.

    // maybe we cache the value + lastUpdatedBlock for each value we are monitoring
    // then we just subscribe to a generic 'block-height' event - could shard by account to improve scalability
    // how do we manage interest in storage locations?

    // TODO: how do we rollup all update events to a single simulation?
    // TODO: we need to spy on every invocation - then add/remove subscriptions
    // TODO: if we do this approach, we may need to use a stream vs pub-sub, or deal
    // with dropped blocks gracefully.
    // when storing values in redis, we may need to store historical versions as well, maybe the last N blocks worth of updates, then scan for the required version when fetching...

}


const args = process.argv.slice(2);

main(args).catch((e) => {
    console.error(e);
    process.exit(1);
})
