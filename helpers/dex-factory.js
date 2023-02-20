const _hre = require("hardhat")
const _config = require('../config.json')
const _IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json')
const _IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json")

const getDex1 = (provider) => {
    return {
        Name: _config.Dex_1.Name,
        Router: new _hre.ethers.Contract(_config.Dex_1.RouterAddress, _IUniswapV2Router02.abi, provider),
        Factory: new _hre.ethers.Contract(_config.Dex_1.FactoryAddress, _IUniswapV2Factory.abi, provider)
    }
}

const getDex2 = (provider) => {
    return {
        Name: _config.Dex_2.Name,
        Router: new _hre.ethers.Contract(_config.Dex_2.RouterAddress, _IUniswapV2Router02.abi, provider),
        Factory: new _hre.ethers.Contract(_config.Dex_2.FactoryAddress, _IUniswapV2Factory.abi, provider)
    }
}

module.exports = {
    getDex1,
    getDex2
}