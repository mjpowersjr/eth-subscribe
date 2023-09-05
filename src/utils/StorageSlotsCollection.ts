export type StorageSlotsByAddress = {
    [key: string]: Set<string>;
};


export class StorageSlotsCollection {

    protected byAddress: StorageSlotsByAddress;

    constructor() {
        this.byAddress = {};
    }

    add(address: string, storageSlot: string) {
        const key = StorageSlotsCollection.normalizeAddress(address);
        this.addAll(address, [storageSlot]);
    }

    addAll(address: string, storageSlots: string[] | Set<string>) {
        const key = StorageSlotsCollection.normalizeAddress(address);

        let storageSet: Set<string> = this.byAddress[key];
        if (!storageSet) {
            this.byAddress[key] = storageSet = new Set();
        }

        for (const storageSlot of storageSlots) {
            storageSet.add(storageSlot)
        }
    }

    getAddresses(): Array<string> {
        return Object.keys(this.byAddress);
    }

    getStorageSlotsFor(address: string): Set<string> {
        const key = StorageSlotsCollection.normalizeAddress(address);
        return this.byAddress[key] || [];
    }

    getAllStorageSlotsByAddress(): StorageSlotsByAddress {
        return this.byAddress;
    }

    protected static normalizeAddress(address: string) {
        return address.toLowerCase();
    }

}
