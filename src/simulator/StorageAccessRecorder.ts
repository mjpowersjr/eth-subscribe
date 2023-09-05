import { VM } from "@ethereumjs/vm";
import { InterpreterStep } from '@ethereumjs/evm';
import { bigIntToHex, padToEven, stripHexPrefix  } from '@ethereumjs/util';
import { StorageSlotsCollection } from "../utils/StorageSlotsCollection";

export class StorageAccessRecorder {

    vm: VM;
    slotRecorder: StorageSlotsCollection

    constructor(vm: VM) {

        this.vm = vm;
        this.slotRecorder = new StorageSlotsCollection();
        this.handleStep = this.handleStep.bind(this);

        vm.evm.events?.on('step', this.handleStep)
    }

    handleStep(data: InterpreterStep): void {
        if (data.opcode.name === 'SLOAD') {
            // console.log({
            //     opcode: data.opcode.name,
            //     stack: data.stack,
            //     account: data.account.toString(),
            //     address: data.address.toString(),
            //     codeAddress: data.codeAddress.toString(),
            // });

            const address = data.codeAddress.toString();
            const storageSlot = StorageAccessRecorder.decodeSlot(data.stack[data.stack.length - 1]);
            this.slotRecorder.add(address, storageSlot);
        }
    }

    static decodeSlot(encoded: bigint): string {
        return '0x'+ padToEven(stripHexPrefix(bigIntToHex(encoded)));
    }


}
