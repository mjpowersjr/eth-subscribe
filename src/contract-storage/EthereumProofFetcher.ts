import { BlockTag, ethers } from 'ethers';

/**
 * Type definition for an Ethereum proof account object.
 */
export interface EthereumAccountProof {
    address: string;
    accountProof: string[];
    balance: string;
    codeHash: string;
    nonce: string;
    storageHash: string;
    storageProof: {
        key: string;
        value: string;
        proof: string[];
    }[];
}

export class EthereumProofFetcher {

    provider: ethers.JsonRpcProvider;

    constructor(props: {
        provider: ethers.JsonRpcProvider;
    }) {
        this.provider = props.provider;
    }

    /**
  * Validates Ethereum address.
  *
  * @param address - The Ethereum address to validate.
  * @returns A boolean indicating the validation result.
  */
    private isValidAddress(address: string): boolean {
        return address.startsWith('0x') && address.length === 42;
    }

    /**
     * Fetches proof for an Ethereum account.
     *
     * @param address - The Ethereum address for which to fetch the proof.
     * @param keys - Array of storage keys for the account to include in the proof.
     * @param blockNumber - The block number to fetch the proof at.
     * @returns A promise resolving to the account proof object.
     * @throws Will throw an error if the address is invalid.
     */
    public async getAccountProof(
        address: string,
        keys: string[],
        blockNumber: BlockTag
    ): Promise<EthereumAccountProof> {
        if (!this.isValidAddress(address)) {
            throw new Error('Invalid Ethereum address');
        }

        // Use JSON-RPC 'eth_getProof' method to fetch the proof.
        const proof = await this.provider.send('eth_getProof', [
            address,
            keys,
            typeof blockNumber === 'number' ? `0x${blockNumber.toString(16)}` : blockNumber
        ]);

        return proof;
    }
}
