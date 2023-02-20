const _ethers = require("ethers")
const _config = require('../config.json')
const _IERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json')

const getMainToken = async provider => {
    const configAddress = _config.MainToken.Address;
    const contract = new _ethers.Contract(configAddress, _IERC20.abi, provider)

    return {
        configName: _config.MainToken.Name,
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
    const configAddress = _config.InterimToken.Address;
    const contract = new _ethers.Contract(configAddress, _IERC20.abi, provider)

    return {
        configName: _config.InterimToken.Name,
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