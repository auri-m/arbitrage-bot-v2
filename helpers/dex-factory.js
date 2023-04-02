const { ethers } = 
    require("ethers")
const config = 
    require('../config.json')
const IUniswapV2Router02 = 
    require('@uniswap/v2-periphery/build/IUniswapV2Router02.json')
const IUniswapV2Factory = 
    require("@uniswap/v2-core/build/IUniswapV2Factory.json")

const getDex = (
    dex_config, 
    provider
) => {
    return {
        Name: dex_config.Name,
        Router: new ethers.Contract(
            dex_config.RouterAddress, 
            IUniswapV2Router02.abi, 
            provider
        ),
        Factory: new ethers.Contract(
            dex_config.FactoryAddress, 
            IUniswapV2Factory.abi, 
            provider
        )
    }
}

const getDex1 = 
    (provider) => 
        getDex(config.Dex_1, provider);

const getDex2 = 
    (provider) => 
        getDex(config.Dex_2, provider);

module.exports = {
    getDex1,
    getDex2
}