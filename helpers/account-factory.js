require("dotenv").config();

const { 
    ethers 
} = require("ethers")

const getAccount = 
    provider => 
        new ethers.Wallet(
            process.env.PRIVATE_KEY, 
            provider
        )

module.exports = {
    getAccount
}