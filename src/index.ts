import {
    provider,
    embeddedRpcServer,
    slotStorageCacheManager,
    blockUpdateManager,
} from './ApplicationContext';
import { LoggerFactory } from './utils/LoggerFactory';

async function main(args: string[]) {
    const log = LoggerFactory.build({ name: 'server' });

    const address = await embeddedRpcServer.listen({
        port: 1999
    });

    blockUpdateManager.start();

    log.info(`Server Started - Waiting for requests on ${address}`)
    log.info(`Hint: Try running one of the following demos.`);
    log.info(`yarn demo:get-reserves`);
    log.info(`yarn demo:balance-of`);

}


const args = process.argv.slice(2);

main(args).catch((e) => {
    console.error(e);
    process.exit(1);
})
