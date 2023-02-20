require("dotenv").config()
const _hre = require("hardhat")

const getProvider = () => new _hre.ethers.providers.WebSocketProvider(process.env.WSS_ENDPOINT)

module.exports = {
    getProvider
}