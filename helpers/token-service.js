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

const calculatePriceForTokens = async (
    pair_contract, 
    main_token_address, 
    interim_token_address
) => {

    const main_token_index_inside_pair = 
        await getTokenIndexInsidePair(
            pair_contract, 
            main_token_address
        )
    const interim_token_index_inside_pair = 
        await getTokenIndexInsidePair(
            pair_contract, 
            interim_token_address
        )
    const result = 
        await calculatePriceForTokenIndexes(
            pair_contract, 
            main_token_index_inside_pair, 
            interim_token_index_inside_pair
        )

    return result;
}

const calculatePriceForTokenIndexes = async (
    pair_contract, 
    main_token_index_inside_pair, 
    interim_token_index_inside_pair
) => {

    // prerequisites
    const reserves = 
        await pair_contract.getReserves();
    
    // reserves 
    const main_token_reserves = 
        reserves[main_token_index_inside_pair];
    const interim_token_reserves = 
        reserves[interim_token_index_inside_pair];

    // prices
    const one_main_token_costs_this_many_interim_tokens = 
        big(interim_token_reserves)
            .div(
                big(main_token_reserves)
            )
    const one_interim_token_costs_this_many_main_tokens = 
        big(main_token_reserves)
            .div(
                big(interim_token_reserves)
            )
    return {
        one_main_token_cost_in_interim: one_main_token_costs_this_many_interim_tokens,
        one_interim_token_cost_in_main: one_interim_token_costs_this_many_main_tokens
    };
}

const getDefaultArbitrageAmount = async (    
    dex_to_buy,
    main_token_address, 
    interim_token_address
) => {

    try {
        const min_amounts = await dex_to_buy.Router.getAmountsOut(
            ethers.utils.parseUnits("1", "ether"),
            [main_token_address, interim_token_address]
        )
    
        return min_amounts[1]

    } catch (error){

        // logError(error)
        console.log(error)

        return null;
    }
}

const determineProfitForInterimTokenAmount = async (
    main_token_address,
    interim_token_address,
    interim_token_amount_to_verify,
    dex_to_buy,
    dex_to_sell
) => {

    try {

        // getAmountsIn(amountOut, [TOKEN_0, TOKEN_1])
        // given the "amountOut" value of TOKEN_1, this function will tell us how many TOKEN_0 we need
        // shows how many TOKEN_0 we need in order to get the "amountOut" of TOKEN_1
        const amounts_on_dex_to_buy = await dex_to_buy.Router.getAmountsIn(
            interim_token_amount_to_verify,
            [main_token_address, interim_token_address]
        )

        // kiek MAIN tokenu reikes norint nupirkti pasirinkta INTERIM tokenu kieki dex to buy
        const main_token_amount_required_to_buy = 
            amounts_on_dex_to_buy[0];

        // getAmountsOut(amountIn, [TOKEN_0, TOKEN_1])
        // given the "amountIn" value of TOKEN_0, this function will tell us how many TOKEN_1 we receive
        // shows how many TOKEN_1 we get from "amountIn" of TOKEN_0
        const amount_on_dex_to_sell = await dex_to_sell.Router.getAmountsOut(
            interim_token_amount_to_verify,
            [interim_token_address, main_token_address]
        )
        
        // kiek main tokenu gausim pardave
        const main_token_amount_received_after_sale = 
            amount_on_dex_to_sell[1]

        // stats
        const profit = 
            main_token_amount_received_after_sale - main_token_amount_required_to_buy;
        const profitable = 
            profit > 0;

        return {
            success: true,
            main_token_amount_required_to_buy,
            main_token_amount_received_after_sale,
            profit,
            profitable,
            interim_token_amount_to_verify
        }
    } catch (error) {

        // logError(error)
        console.log(error)

        return {
            success: false,
            main_token_amount_required_to_buy: null,
            main_token_amount_received_after_sale: null,
            profit: null,
            profitable: null,
            interim_token_amount_to_verify: null
        }
    }

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

const calculateMainTokenPriceDifferencePercentage = async(
    dex_1_pair_contract, 
    dex_2_pair_contract, 
    main_token_addres,
    interim_token_addres
) => {
    // on chain price with decimals
    const dex_1_on_chain_prices = 
        await calculatePriceForTokens(
            dex_1_pair_contract, 
            main_token_addres, 
            interim_token_addres
        )
    const dex_2_on_chain_prices = 
        await calculatePriceForTokens(
            dex_2_pair_contract, 
            main_token_addres, 
            interim_token_addres
        )

    // rounded price
    const main_token_dex_1_price = 
        Number(dex_1_on_chain_prices.one_main_token_cost_in_interim)
    const main_token_dex_2_price = 
        Number(dex_2_on_chain_prices.one_main_token_cost_in_interim)

    // price difference as a percentage
    const main_token_price_difference_percentage = 
        (((main_token_dex_1_price - main_token_dex_2_price) / main_token_dex_2_price) * 100).toFixed(2)

    return main_token_price_difference_percentage;
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
    else if (price_difference_percentage <= -(min_price_difference_percentage)) {
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
    getTokenIndexInsidePair,
    determinePotentialTradeOrder,
    calculatePriceForTokens,
    calculatePriceForTokenIndexes,
    calculateMainTokenPriceDifferencePercentage,
    getDefaultArbitrageAmount,
    determineProfitForInterimTokenAmount
}