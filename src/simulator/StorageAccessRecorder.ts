import { VM } from "@ethereumjs/vm";
import { InterpreterStep } from '@ethereumjs/evm';
import { bigIntToHex, padToEven, stripHexPrefix } from '@ethereumjs/util';
import { StorageSlotsCollection } from "../utils/StorageSlotsCollection";
import { Logger, LoggerFactory } from "../utils/LoggerFactory";

export class StorageAccessRecorder {

    vm: VM;
    slotRecorder: StorageSlotsCollection
    log: Logger;

    constructor(vm: VM) {

        this.vm = vm;
        this.slotRecorder = new StorageSlotsCollection();
        this.handleStep = this.handleStep.bind(this);

        this.log = LoggerFactory.build({
            name: StorageAccessRecorder.name,
        });

        vm.evm.events?.on('step', this.handleStep)
    }

    handleStep(data: InterpreterStep): void {
        this.log.trace(data);

        if (data.opcode.name === 'SLOAD') {
            // const address = data.codeAddress.toString();
            const address = data.address.toString();
            const storageSlot = StorageAccessRecorder.decodeSlot(data.stack[data.stack.length - 1]);            
           
            this.log.debug({
                opcode: data.opcode.name,
                stack: data.stack,
                account: data.account.toString(),
                address: data.address.toString(),
                codeAddress: data.codeAddress.toString(),
                storageSlot,
            });

            this.slotRecorder.add(address, storageSlot);
        }
    }

    static decodeSlot(encoded: bigint): string {
        return '0x' + padToEven(stripHexPrefix(bigIntToHex(encoded)));
    }


}
