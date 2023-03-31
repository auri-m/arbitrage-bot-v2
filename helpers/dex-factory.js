const { ethers } = 
    require("ethers")
const config = 
    require('../config.json')
const IUniswapV2Router02 = 
    require('@uniswap/v2-periphery/build/IUniswapV2Router02.json')
const IUniswapV2Factory = 
    require("@uniswap/v2-core/build/IUniswapV2Factory.json")

const getDex1 = (provider) => {
    return {
        Name: config.Dex_1.Name,
        Router: new ethers.Contract(
            config.Dex_1.RouterAddress, 
            IUniswapV2Router02.abi, 
            provider
        ),
        Factory: new ethers.Contract(
            config.Dex_1.FactoryAddress, 
            IUniswapV2Factory.abi, 
            provider
        )
    }
}

const getDex2 = (provider) => {
    return {
        Name: config.Dex_2.Name,
        Router: new ethers.Contract(
            config.Dex_2.RouterAddress, 
            IUniswapV2Router02.abi, 
            provider
        ),
        Factory: new ethers.Contract(
            config.Dex_2.FactoryAddress, 
            IUniswapV2Factory.abi, 
            provider
        )
    }
}

module.exports = {
    getDex1,
    getDex2
}