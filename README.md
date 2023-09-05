# Get Started

```sh
# install deps
yarn install

# launch redis
docker compose up

# start server (new terminal)
yarn server:start

# start demos (new terminals)
yarn demo:balance-of
yarn demo:get-reserves

```


# RANDOM NOTES
https://github.com/Vectorized/solady/blob/main/src/utils/LibZip.sol


// https://github.com/ethereum/EIPs/issues/781
// https://blog.infura.io/post/how-to-use-ethereum-proofs-2
// for a given eth_call txn
// run once at latest block, spy on getStorage access
// update redis cache w. latest results
// setup subscriptions to each storage address

// on new block, get storage for all subscriptions
// update redis cache
// publish updates on redis channel - the channels will be <contract>:<key> - message will be blockNumber
// listeners should run at-most once per block update, may need a lock etc.

// maybe we cache the value + lastUpdatedBlock for each value we are monitoring
// then we just subscribe to a generic 'block-height' event - could shard by account to improve scalability
// how do we manage interest in storage locations?

// TODO: how do we rollup all update events to a single simulation?
// TODO: we need to spy on every invocation - then add/remove subscriptions
// TODO: if we do this approach, we may need to use a stream vs pub-sub, or deal
// with dropped blocks gracefully.
// when storing values in redis, we may need to store historical versions as well, maybe the last N blocks worth of updates, then scan for the required version when fetching...
