import redis from "@redis/client";

export abstract class PubSubSubscription {

    protected client: redis.RedisClientType;

    constructor() {
        this.client = redis.createClient();

    }

    protected async subscribeToChannels(channels: Array<string>): Promise<void> {
        await this.client.SUBSCRIBE(channels, this.handleMessage);
    }

    protected async subscribeToPatterns(patterns: Array<string>): Promise<void> {
        await this.client.PSUBSCRIBE(patterns, this.handleMessage);
    }

    protected async unsubscribeToChannels(channels: Array<string>): Promise<void> {
        await this.client.UNSUBSCRIBE(channels);

    }

    protected async unsubscribeToPatterns(patterns: Array<string>): Promise<void> {
        await this.client.PUNSUBSCRIBE(patterns);

    }

    protected handleMessage(data: any) : void {

    }

}
