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


const pickArbitrageAmount = (amount1, amount2) => {
    if(big(amount1).lt(big(amount2))){
        return amount1;
    }
    return amount2;
}

const getDefaultArbitrageAmount = async (    
    dex_to_buy,
    main_token_address, 
    interim_token_address
) => {

    try {
        const min_amounts = await dex_to_buy.Router.getAmountsOut(
            ethers.utils.parseUnits(1, "ether"),
            [main_token_address, interim_token_address]
        )
    
        return min_amounts[1]

    } catch (error){

        logError(error)
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
            [token1.address, token0.address]
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

        logError(error)
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

const pickOptimalArbitrageAmmount = async (
    interim_token_reserves_on_dex_to_buy, 
    dex_to_sell, 
    dex_to_buy,
    main_token_address, 
    interim_token_address,
    current_main_token_balance
) => {

    // cia biski negerai 
    // man reikia rasti max amounta main tokenu
    // kad pardavaus butu daugiau pinigu negu reikia pasiskolint





    console.log(`total reserves 1 => ${interim_token_reserves_on_dex_to_buy}`)

    const token_path = [
        interim_token_address, 
        main_token_address
    ]

    const mid_ratio = 0.5;
    const go_higer_ranges = [0.75, 0.9]
    const go_lower_ranges = [0.25, 0.1, 0.05]
    const interim_token_reserves = big(interim_token_reserves_on_dex_to_buy)

    // default last profitable amount 
    //  => amount of interim tokes we can get for 1 main token   
    const min_amounts = await dex_to_buy.Router.getAmountsOut(
        ethers.utils.parseUnits(1, "ether"),
        [main_token_address, interim_token_address]
    )
    let last_profitable_amount = min_amounts[1];
    let last_profitable_range;

    console.log("1")

    // starting point
    const mid_reserve = 
        interim_token_reserves.times(mid_ratio).round();

    console.log(`total reserves 2 => ${interim_token_reserves.toFixed()}`)
    console.log(`mid reserves => ${mid_reserve.toFixed()}`)

    
    const main_token_amount_to_receive_on_dex_to_sell = 
        await checkMainTokenAmountReceived(
            dex_to_sell, 
            token_path, 
            mid_reserve.toFixed()
        );

    console.log("2")
    
    if(main_token_amount_to_receive_on_dex_to_sell > current_main_token_balance) {

        last_profitable_amount = mid_reserve;
        last_profitable_range = mid_ratio;

        console.log("3")

        for(let i = 0; i < go_higer_ranges.length; i++){

            const rsrv = interim_token_reserves.times(go_higer_ranges[i]).round();
            const reserve_amount =  
                await checkMainTokenAmountReceived(
                    dex_to_sell, 
                    token_path, 
                    rsrv.toFixed()
                );
            if(reserve_amount < current_main_token_balance){
                break;
            }                  
    
            last_profitable_amount = reserve_amount
            last_profitable_range = go_higer_ranges[i]
    
        }
    } else {

        console.log("4")

        for(let i = 0; i < go_lower_ranges.length; i++){

            const rsrv = interim_token_reserves.times(go_lower_ranges[i]).round();
            const reserve_amount =  
                await checkMainTokenAmountReceived(
                    dex_to_sell, 
                    token_path, 
                    rsrv.toFixed()
                );
            if(reserve_amount > current_main_token_balance){
                last_profitable_amount = reserve_amount
                last_profitable_range = go_lower_ranges[i]
                break;
            }                        
        }
    }

    console.log(`\nTotal amount of interim tokes for arbitrage => ${interim_token_reserves_on_dex_to_buy}`)
    console.log(`Optimal amount => ${last_profitable_amount.toFixed()}`)
    console.log(`Optimal amount range => ${last_profitable_range}`)

    return last_profitable_amount.toFixed();
}


const checkMainTokenAmountReceived = async (
    dex_to_sell, 
    token_path, 
    interim_token_amount_to_check
) => {

    // getAmountsOut(amountIn, [TOKEN_0, TOKEN_1])
    // given the "amountIn" value of TOKEN_0, this function will tell us how many TOKEN_1 we receive
    // shows how many TOKEN_1 we get from "amountIn" of TOKEN_0


    const tokens_from_dex_to_sell = 
        await dex_to_sell.Router.getAmountsOut(
            interim_token_amount_to_check.toString(),
            token_path
        )
    return tokens_from_dex_to_sell[1] // main token (token_path[1])
}



const estimateMainTokenProfit = async (
    token0_amount_required_to_buy_token1_on_dex_to_buy, 
    dex_to_buy, 
    dex_to_sell, 
    token0, 
    token1
) => {

    const dexToBuy_Router = 
        dex_to_buy.Router;
    const dexToSell_Router = 
        dex_to_sell.Router;

    const trade1 = 
        await dexToBuy_Router.getAmountsOut(
            token0_amount_required_to_buy_token1_on_dex_to_buy, 
            [token0.address, token1.address]
        )
    const amount_of_token0_spent_on_dex_to_buy = 
        trade1[0]
    const amount_of_token1_received_on_dex_to_buy = 
        trade1[1]

    console.log(`estimateMainTokenProfit => token 1 bought ${ethers.utils.formatUnits(amount_of_token1_received_on_dex_to_buy, "ether")}`)

    const trade2 = 
        await dexToSell_Router.getAmountsOut(
            amount_of_token1_received_on_dex_to_buy, 
            [token1.address, token0.address]
        )
    const amount_of_token0_received_on_dex_to_sell = 
        trade2[1];

    const estimated_token0_amount_to_spend_on_dex_to_buy = 
        Number(ethers.utils.formatUnits(
            amount_of_token0_spent_on_dex_to_buy, 
            "ether"
            )
        )
    const estimated_token0_amount_to_receive_from_dex_to_sell = 
        Number(ethers.utils.formatUnits(
            amount_of_token0_received_on_dex_to_sell, 
            "ether"
            )
        )
    
    console.log(`estimateMainTokenProfit => token 0 received after selling bought ${estimated_token0_amount_to_receive_from_dex_to_sell})}`)

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
    const dex_1_price = 
        Number(dex_1_on_chain_price).toFixed(0)
    const dex_2_price = 
        Number(dex_2_on_chain_price).toFixed(0)

    // price difference as a percentage
    const price_difference_percentage = 
        (((dex_1_price - dex_2_price) / dex_2_price) * 100).toFixed(2)

    return price_difference_percentage;
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
    estimateMainTokenProfit,
    pickArbitrageAmount,
    getTokenIndexInsidePair,
    calculatePriceDifferencePercentage,
    determinePotentialTradeOrder,
    calculatePrice,
    calculatePriceForTokens,
    calculatePriceForTokenIndexes,
    calculateMainTokenPriceDifferencePercentage,
    pickOptimalArbitrageAmmount,
    getDefaultArbitrageAmount,
    determineProfitForInterimTokenAmount
}