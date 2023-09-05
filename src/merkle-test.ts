import { ethers } from 'ethers';
import { Trie } from '@ethereumjs/trie';
import { hexToBytes, bytesToHex, } from '@ethereumjs/util';
import assert from 'assert';

// We hard code the storage slots and contract address here.
// You can change the target contract address and storage slots
// to any values you wish to run the proof on.
// const CONTRACT_ADDR = '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e';
// const STORAGE_SLOTS = [
//     "0xf8b3ca70e07afc9d3c9a4f37fd6adccac81587450545d4b161205b35bf9b1ecd",
//     "0xf8b3ca70e07afc9d3c9a4f37fd6adccac81587450545d4b161205b35bf9b1ece",
// ];

const CONTRACT_ADDR = '0x70258aa9830c2c84d855df1d61e12c256f6448b4';
const STORAGE_SLOTS = [
    '0x' + '0'.repeat(64),
];
for(let i = 0; i < 10_000; i++) {
    STORAGE_SLOTS.push('0x' + i.toString(16).padStart(64, '0'));
}

const main = async () => {
    const rpc = new ethers.JsonRpcProvider(
        `https://mainnet.infura.io/v3/dbee8026e4154623b4711781185c3cc6`,
        'mainnet'
    );

    // We get the latest blockNumber so that we can do additional calls based on
    // a static block target. Using latest may cause unstable results it could 
    // stradle multiple blocks as the script executes
    const latestBlockNumber = await rpc.send('eth_blockNumber', []);
    const previousBlockNumber = '0x' + (Number(latestBlockNumber) -1) .toString(16);

    console.time('eth_getBlockByNumber')
    const { stateRoot } = await rpc.send('eth_getBlockByNumber', [latestBlockNumber, false]);
    console.timeEnd('eth_getBlockByNumber');
    console.log(`State Root for Block [${latestBlockNumber}]: ${stateRoot}\n`);

    console.log({
        previousBlockNumber,
        latestBlockNumber,
    });

    // Get the Proof
    console.time('eth_getProof')
    const proof = await rpc.send('eth_getProof', [
        CONTRACT_ADDR,
        STORAGE_SLOTS,
        latestBlockNumber,
    ]);
    console.timeEnd('eth_getProof');

    // Account Proof
    // Create a new Trie from the stateRoot pulled from the most current block header.
    // This part of the validation will take the account information that is used in 
    // calculating the block's stateRoot.
    // We use the option of `useKeyHashing` to enable the key hashing algorithm that
    // Ethereum uses.
    const trie = new Trie({ root: hexToBytes(stateRoot), useKeyHashing: true });

    // Transform all of the encoded data in the accountProof array to buffers
    // Then populate the tree from the proof
    await trie.fromProof(proof.accountProof.map((p: string) => hexToBytes(p)))

    //Look up the account address as the key for the tree
    // The `true` param here will cause an exception to be thrown if there is not a 
    // valid path through the trie to fetch the value.
    const val = await trie.get(hexToBytes(CONTRACT_ADDR), true)

    // Validate that information returned is correct:
    // RLP([ nonce, value, storageHash, codeHash ])
    // We need to run all of the output through a hex normalizer to account for encoding 
    // anomalies: 0x vs 0x0 0x1 vs 0x01 etc.
    console.log(`Checking: [${proof.nonce}, ${proof.balance}, ${proof.storageHash}, ${proof.codeHash}]`);
    const dec = ethers.decodeRlp(bytesToHex(val!)) as Array<string>

    assert(ethers.toQuantity(dec[0]) == ethers.toQuantity(proof.nonce),
        'Nonce does not match')
    assert(ethers.toQuantity(dec[1]) == ethers.toQuantity(proof.balance),
        'Value does not match')
    assert(dec[2] == proof.storageHash, 'StorageHash does not match')
    assert(dec[3] == proof.codeHash, 'CodeHash does not match')

    console.log('State Root is good\n');


    // With the account information validated, we know the storageHash is valid.
    // To validate the Storage Proof, we can create a Merkle tree using the storageHash
    // as the root of the Merkle tree and validate the storage values.
    console.log(`Proving for storageHash: ${proof.storageHash}`)

    const storageTrie = new Trie({ root: hexToBytes(proof.storageHash), useKeyHashing: true })

    for (var i = 0; i < STORAGE_SLOTS.length; i++) {
        const proofBuffer = proof.storageProof[i].proof.map((p: string) => hexToBytes(p));
        storageTrie.fromProof(proofBuffer);

        // Pull the values from the Merkle trie we just built from the proofs
        const storageVal = await storageTrie.get(hexToBytes(STORAGE_SLOTS[i]), true)

        if (storageVal == null) {
            console.log("Nothing returned")
        } else {
            if (i == 0) { // The storage of resolvers is a record. The first field is owner
                console.log(`Owner: ${ethers.decodeRlp(bytesToHex(storageVal))}`)
            }
            else if (i == 1) {// Second field is the resolver contract
                console.log(`Resolver: ${ethers.decodeRlp(bytesToHex(storageVal))}`)
            }
            else if (i == 2) {// Third field is TTL if it's set
                console.log(`TTL: ${ethers.decodeRlp(bytesToHex(storageVal))}`)
            } else {
                console.log('Field unknown')
            }
        }
    }
}


main()
