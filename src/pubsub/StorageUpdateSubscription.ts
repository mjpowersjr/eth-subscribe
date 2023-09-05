import { AddressStorageCacheCodec } from "../codecs/AddressStorageCacheCodec";
import { ArrayUtils } from "../utils/ArrayUtils";
import { PubSubSubscription } from "./PubSubSubscription";

export class StorageUpdateSubscription extends PubSubSubscription {

    private codec: AddressStorageCacheCodec;
    readonly address: string;
    private storageSlots: Array<string>;

    constructor(props: {
        address: string;
        storageSlots: Array<string>;
    }) {
        super();
        this.codec = new AddressStorageCacheCodec();
        this.address = props.address;
        this.storageSlots = props.storageSlots;
    }

    async setStorageSlots(newStorageSlots: Array<string>): Promise<void> {
        const changes = ArrayUtils.compare(this.storageSlots, newStorageSlots);

        const toAdd = changes.added.map((it) => this.codec.encodeAsCacheKey(this.address, it))
        const toRemove = changes.removed.map((it) => this.codec.encodeAsCacheKey(this.address, it))

        await this.client.subscribe(toAdd, this.handleMessage);
        await this.client.unsubscribe(toRemove, this.handleMessage);
        this.storageSlots = newStorageSlots;
    }

    getStorageSlots(): Array<string> {
        return this.storageSlots;
    }



}
