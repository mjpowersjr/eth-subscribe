import { BlockTag, ethers } from "ethers";
import { Account, Address } from '@ethereumjs/util'
import { hexToBytes } from '@ethereumjs/util'
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';
import { VM } from '@ethereumjs/vm';
import { Chain, Common, Hardfork, EVMStateManagerInterface } from '@ethereumjs/common'
import { LegacyTransaction } from '@ethereumjs/tx';
import { Interface, defaultAbiCoder as AbiCoder } from '@ethersproject/abi'
import { CachingStateManager } from "./CachingStateManager";
import { StorageSlotsCollection } from "../utils/StorageSlotsCollection";
import { StorageAccessRecorder } from "./StorageAccessRecorder";
import { EVMResult } from '@ethereumjs/evm'

const encodeFunction = (
    method: string,
    params?: {
        types: any[]
        values: unknown[]
    }
): string => {
    const parameters = params?.types ?? []
    const methodWithParameters = `function ${method}(${parameters.join(',')})`
    const signatureHash = new Interface([methodWithParameters]).getSighash(method)
    const encodedArgs = AbiCoder.encode(parameters, params?.values ?? [])

    return signatureHash + encodedArgs.slice(2)
}

export type SimulatorOpts = {
    stateManager: EVMStateManagerInterface;
}

export type RunOpts = {
    address: string;
    data: string;
    blockNumber: BlockTag;
}

export type RunResult = {
    result: EVMResult;
    accessedStorage: StorageSlotsCollection;
}

export class Simulator {

    stateManager: EVMStateManagerInterface;
    constructor(opts: SimulatorOpts) {
        this.stateManager = opts.stateManager;
    }

    async simulate(opts: RunOpts): Promise<RunResult> {
        const common = new Common({
            chain: Chain.Mainnet,
            hardfork: Hardfork.Shanghai,
        });

        const vm = await VM.create({ common, stateManager: this.stateManager });
        const storageAccessRecorder = new StorageAccessRecorder(vm);

        const result = await vm.evm.runCall({
            to: Address.fromString(opts.address),
            data: hexToBytes(opts.data),
        })
        
        return {
            result: result,
            accessedStorage: storageAccessRecorder.slotRecorder,
        }

    }

}
