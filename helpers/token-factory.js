const { 
    ethers 
} = require("ethers")
const config = 
    require('../config.json')
const IERC20 = 
    require('@openzeppelin/contracts/build/contracts/ERC20.json')

const getToken = async (token_config, provider) => {
    const contract = 
        new ethers.Contract(
            token_config.Address, 
            IERC20.abi, 
            provider)

    return {
        configName: token_config.Name,
        address: token_config.Address,
        decimals: await contract.decimals(),
        symbol: await contract.symbol(),
        name: await contract.name(),
        contract: contract,
        index_Inside_Dex1_Pair: null,   // determined from the actual dex pair
        index_Inside_Dex2_Pair: null    // determined from the actual dex pair
    }
}

const getMainToken = 
    async provider => 
        getToken(config.MainToken, provider)

const getInterimToken = 
    async provider => 
        getToken(config.InterimToken, provider)

module.exports = {
    getMainToken,
    getInterimToken
}