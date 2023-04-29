const {
    ethers
} = require("ethers")

const {
    getAmountOut,
    getAmountIn
} = require('./uniswap-v2-library-service')

const getDefaultArbitrageAmount_simulated = (
    main_token_arbitrage_amount,
    main_token,
    main_token_reserves_on_dex_to_buy,
    interim_token_reserves_on_dex_to_buy
) => {

    try {
        const main_token_arbitrage_amount_in_wei =
            ethers.utils.parseUnits(
                main_token_arbitrage_amount,
                main_token.decimals
            )

        const amount_out =
            getAmountOut(
                main_token_arbitrage_amount_in_wei,
                main_token_reserves_on_dex_to_buy,
                interim_token_reserves_on_dex_to_buy
            )

        return amount_out.toFixed(0);

    } catch (error) {

        console.log("error in getDefaultArbitrageAmount_simulated")
        console.log(error)

        return null;
    }
}

const determineProfitForInterimTokenAmount_simulated = (
    interim_token_amount_to_verify,
    interim_token_reserves_on_dex_to_buy,
    interim_token_reserves_on_dex_to_sell,
    main_token_reserves_on_dex_to_buy,
    main_token_reserves_on_dex_to_sell
) => {

    try {
        // simuliuoja kiek MAIN tokenu reikes norint nupirkti pasirinkta INTERIM tokenu kieki dex to buy
        const main_token_amount_required_to_buy =
            getAmountIn(
                interim_token_amount_to_verify,
                main_token_reserves_on_dex_to_buy,
                interim_token_reserves_on_dex_to_buy
            )

        // simuliuoja kiek main tokenu gausim pardave
        const main_token_amount_received_after_sale =
            getAmountOut(
                interim_token_amount_to_verify,
                interim_token_reserves_on_dex_to_sell,
                main_token_reserves_on_dex_to_sell
            )

        // stats
        const profit =
            main_token_amount_received_after_sale.minus(main_token_amount_required_to_buy).toFixed(0)

        const profitable =
            profit > 0;

        return {
            success: true,
            main_token_amount_required_to_buy: main_token_amount_required_to_buy.toFixed(0),
            main_token_amount_received_after_sale: main_token_amount_received_after_sale.toFixed(0),
            profit,
            profitable,
            interim_token_amount_to_verify
        }
    } catch (error) {

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

module.exports = {
    getDefaultArbitrageAmount_simulated,
    determineProfitForInterimTokenAmount_simulated
}