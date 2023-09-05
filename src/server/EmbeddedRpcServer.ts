import fastify, { FastifyReply, FastifyRequest } from "fastify";
import { EthSubscribeClient } from "../client/EthSubscribeClient";
import { EthCallSubscription } from "../EthCallSubscription";
import { SlotStorageCacheManager } from "../contract-storage/SlotStorageCacheManager";
import { BlockTag, ethers } from "ethers";
import { RedisClientFactory } from "../RedisClientFactory";
import { EVMResult } from '@ethereumjs/evm';
import { bytesToHex } from '@ethereumjs/util';
import { LoggerFactory } from "../utils/LoggerFactory";

export interface EmbeddedRpcServerProps {
    storageManager: SlotStorageCacheManager;
    provider: ethers.JsonRpcProvider;
}

export class EmbeddedRpcServer {

    static create({
        provider,
        storageManager,
    }: EmbeddedRpcServerProps) {

        const log = LoggerFactory.build({
            name: EmbeddedRpcServer.name,
        });


        const server = fastify()
        server.post('/subscribe', async (request: FastifyRequest, reply: FastifyReply) => {
            log.debug({
                msg: 'POST /subscribe',
                body: request.body,
            });

            const {
                callback,
                address,
                data
            } = request.body as any;

            const callbackClient = new EthSubscribeClient(callback);

            const ethCallSubscription = new EthCallSubscription({
                provider,
                storageManager,
                redisClient: await RedisClientFactory.getInstance(),
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
                await callbackClient.sendCallback({
                    blockNumber: '0x' + blockNumber.toString(16),
                    returnValue: bytesToHex(result.execResult.returnValue)
                });
            })

            await ethCallSubscription.start();
        });

        return server;
    }

}
