require("@nomicfoundation/hardhat-toolbox")
require("dotenv").config()
const _config = require('./config.json')

module.exports = {
  solidity: "0.8.9",
  networks: {
    hardhat: {
      forking: {
        url: process.env.HARDHAT_FORKING_ENDPOINT,
      }
    }
  }
};
