import axios from "axios";
import { CallbackBody } from "./EmbeddedWebhookServer";

export interface SubscriptionInput {
    address: string;
    callback: string;
    data: string;
}


export class EthSubscribeClient {

    endpoint: string;
    
    constructor(endpoint: string) {
        this.endpoint = endpoint; 
    }

    async subscribe(data: SubscriptionInput) : Promise<void> {
        axios.request({
            method: 'post',
            url: this.endpoint + '/subscribe',
            data,
        })
    }

    async sendCallback( data: CallbackBody) : Promise<void> {
        await axios.request({
            method: 'post',
            url: this.endpoint,
            data
        });
    }

}
