const { ethers } = 
    require("ethers")
const big = 
    require('big.js')
const IUniswapV2Pair = 
    require("@uniswap/v2-core/build/IUniswapV2Pair.json")

const getPairAddress = async (
    V2Factory, 
    token0, 
    token1
) => {
    const pairAddress = 
        await V2Factory.getPair(
            token0, 
            token1
        )
    return pairAddress
}

const getPairContract = async (
    V2Factory, 
    token0, 
    token1, 
    provider
) => {
    const pairAddress = 
        await getPairAddress(
            V2Factory, 
            token0, 
            token1
        )
    const pairContract = 
        new ethers.Contract(
            pairAddress, 
            IUniswapV2Pair.abi, 
            provider
        )
    return pairContract
}

const getReserves = async (pairContract) => {
    const reserves = 
        await pairContract.getReserves()
    return [
        reserves.reserve0, 
        reserves.reserve1
    ]
}

const calculatePrice = async (pairContract) => {
    const [x, y] = 
        await getReserves(pairContract)
    return big(x).div(big(y))
}

const calculateDifference = async (uPrice, sPrice) => {
    return (((uPrice - sPrice) / sPrice) * 100).toFixed(2)
}

const pickArbitrageAmount = (amount1, amount2) => {
    // todo 
    // maybe make this 90% or something?
    // test locally first and then decide, if 100% then leave it as is

    if(big(amount1).lt(big(amount2))){
        return amount1;
    }
    return amount2;
}

const estimateMainTokenProfit = async (
    token0_amount_required_to_buy_token1_on_dex_to_buy, 
    trade_order, 
    token0, 
    token1
) => {

    if(!trade_order)
        throw "no trade order provided";  
    if(!trade_order.TradeOrderAvailable)
        throw "trade order provided does not have a path";  


    const dexToBuy_Router = trade_order.DexToBuy.Router;
    const dexToSell_Router = trade_order.DexToSell.Router;

    const trade1 = await dexToBuy_Router.getAmountsOut(token0_amount_required_to_buy_token1_on_dex_to_buy, [token0.address, token1.address])
    const amount_of_token0_spent_on_dex_to_buy = trade1[0]
    const amount_of_token1_received_on_dex_to_buy = trade1[1]

    const trade2 = await dexToSell_Router.getAmountsOut(amount_of_token1_received_on_dex_to_buy, [token1.address, token0.address])
    const amount_of_token0_received_on_dex_to_sell = trade2[1];

    const estimated_token0_amount_to_spend_on_dex_to_buy = Number(ethers.utils.formatUnits(amount_of_token0_spent_on_dex_to_buy, 'ether'))
    const estimated_token0_amount_to_receive_from_dex_to_sell = Number(ethers.utils.formatUnits(amount_of_token0_received_on_dex_to_sell, 'ether'))

    return estimated_token0_amount_to_receive_from_dex_to_sell - estimated_token0_amount_to_spend_on_dex_to_buy
}

const getTokenIndexInsidePair = async (
    pair_contract, 
    token_address
) => {
    const pair_token_0 = 
        await pair_contract.token0();
    const pair_token_1 = 
        await pair_contract.token1();

    if(token_address === pair_token_0)
      return 0
    else if (token_address === pair_token_1)
      return 1

    throw `cannot determine token ${token_address} possition`;   
}

const calculatePriceDifferencePercentage = async(
    dex_1_pair_contract, 
    dex_2_pair_contract, 
) => {
    // on chain price with decimals
    const dex_1_on_chain_price = 
        await calculatePrice(dex_1_pair_contract)
    const dex_2_on_chain_price = 
        await calculatePrice(dex_2_pair_contract)

    // rounded price
    const dex_1_price = Number(dex_1_on_chain_price).toFixed(0)
    const dex_2_price = Number(dex_2_on_chain_price).toFixed(0)

    // price difference as a percentage
    const price_difference_percentage = 
        (((dex_1_price - dex_2_price) / dex_2_price) * 100).toFixed(2)

    return price_difference_percentage;
}

const determinePotentialTradeOrder = async( 
    price_difference_percentage,
    min_price_difference_percentage,
    dex_1, 
    dex_2,
) => {
  
    const trade_order = {
        TradeOrderAvailable: false,
        DexToBuy: null,
        DexToSell: null
    }
   
    if (price_difference_percentage >= min_price_difference_percentage) {
        trade_order.TradeOrderAvailable = true;
        trade_order.DexToBuy = dex_1;
        trade_order.DexToSell = dex_2;      
    }
    else if (currentPriceDifferencePercentage <= -(min_price_difference_percentage)) {
        trade_order.TradeOrderAvailable = true;
        trade_order.DexToBuy = dex_2;
        trade_order.DexToSell = dex_1;     
    }

    return trade_order;    
}

module.exports = {
    getPairAddress,
    getPairContract,
    getReserves,
    estimateMainTokenProfit,
    pickArbitrageAmount,
    getTokenIndexInsidePair,
    calculatePriceDifferencePercentage,
    determinePotentialTradeOrder
}