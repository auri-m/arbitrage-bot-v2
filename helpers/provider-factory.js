require("dotenv")
    .config()
const { ethers } = 
    require("ethers")

const getProvider = () => 
    new ethers.providers.WebSocketProvider(process.env.WSS_ENDPOINT)

module.exports = {
    getProvider
}