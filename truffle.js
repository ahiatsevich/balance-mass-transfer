var HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id
      gas: 4700000
    },
    rinkeby: {
      network_id: 4,
      host: 'localhost',
      port: 8545,
      gas: 4700000,
      gasPrice: 20000000000 // 20 Gwei
    },
    test: {
      network_id: 424242,
      host: 'localhost',
      port: 9545,
      gas: 4700000
    }
  },
  migrations_directory: './migrations'
}
