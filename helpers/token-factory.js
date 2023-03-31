const { 
    ethers 
} = require("ethers")
const config = 
    require('../config.json')
const IERC20 = 
    require('@openzeppelin/contracts/build/contracts/ERC20.json')

const getMainToken = async provider => {
    const configAddress = 
        config.MainToken.Address;
    const contract = 
        new ethers.Contract(
            configAddress, 
            IERC20.abi, 
            provider
        )

    return {
        configName: config.MainToken.Name,
        address: configAddress,
        decimals: 18,
        symbol: await contract.symbol(),
        name: await contract.name(),
        contract: contract,
        index_Inside_Dex1_Pair: null,   // determined from the actual dex pair
        index_Inside_Dex2_Pair: null    // determined from the actual dex pair
    }
}

const getInterimToken = async provider => {
    const configAddress = 
        config.InterimToken.Address;
    const contract = 
        new ethers.Contract(
            configAddress, 
            IERC20.abi, 
            provider
        )

    return {
        configName: config.InterimToken.Name,
        address: configAddress,
        decimals: 18,
        symbol: await contract.symbol(),
        name: await contract.name(),
        contract: contract,
        index_Inside_Dex1_Pair: null,   // determined from the actual dex pair
        index_Inside_Dex2_Pair: null    // determined from the actual dex pair
    }
}

module.exports = {
    getMainToken,
    getInterimToken
}