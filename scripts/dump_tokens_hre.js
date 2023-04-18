require("dotenv")
    .config()

const hre =
    require("hardhat")

const {
    getProvider
} = require('../helpers/provider-factory')

const {
    getDex1,
    getDex2
} = require('../helpers/dex-factory')

const {
    getMainToken,
    getInterimToken
} = require('../helpers/token-factory')

const {
    getPairContract,
    calculatePriceForTokens,
    getMainTokenPriceOnDex
} = require('../helpers/token-service')

const main = async () => {

    console.log("initializing...");

    // initialize
    const {
        main_token,
        interim_token,
        dex_1,
        dex_2,
        dex_1_pair_contract,
        dex_2_pair_contract
    } = await init();

    console.log("initialized");

    // some variable mapping to make the logic clearer
    const dex_to_swap = dex_1
    const dex_to_swap_pair_contract = dex_1_pair_contract;

    const other_dex = dex_2;
    const other_dex_pair_contract = dex_2_pair_contract;

    // wmatic holder
    // "0x0AFF6665bB45bF349489B20E225A6c5D78E2280F"

    // tether holder
    // "0xee5B5B923fFcE93A870B3104b7CA09c3db80047A"

    // woo holder
    // 0x63dfe4e34a3bfc00eb0220786238a7c6cef8ffc4

    const token_to_swap = interim_token;
    const token_to_receive = main_token;
    const wallet_to_impersonate = "0x63dfe4e34a3bfc00eb0220786238a7c6cef8ffc4";
    const token_amount_to_swap = "10000";

    const prices_before = await calculatePriceForTokens(
        dex_to_swap_pair_contract, 
        main_token, 
        interim_token
    )
    const prices_another = await calculatePriceForTokens(
        other_dex_pair_contract, 
        main_token, 
        interim_token
    )

    const new_main_token_price_before = 
        await getMainTokenPriceOnDex(
            dex_to_swap, 
            token_to_receive, 
            token_to_swap
        )

    const new_main_token_price_other = 
        await getMainTokenPriceOnDex(
            other_dex, 
            token_to_receive, 
            token_to_swap
        )

    console.log(`\nswaping ${token_amount_to_swap} tokens`);

    // swap
    await swap(
        dex_to_swap,
        token_to_swap,
        token_to_receive,
        wallet_to_impersonate,
        token_amount_to_swap
    )

    const prices_after = await calculatePriceForTokens(
        dex_to_swap_pair_contract, 
        main_token, 
        interim_token
    )

    const new_main_token_price_after = 
        await getMainTokenPriceOnDex(
            dex_to_swap, 
            token_to_receive, 
            token_to_swap
        )

    // resulting price difference
    console.log("\nMathematical price")
    console.table({
        'Main Token Price Before': `1 ${main_token.symbol} = ${Number(prices_before.one_main_token_cost_in_interim)} ${interim_token.symbol}`,
        'Main Token Price After': `1 ${main_token.symbol} = ${Number(prices_after.one_main_token_cost_in_interim)} ${interim_token.symbol}`,
        'Main Token Price On Other Dex': `1 ${main_token.symbol} = ${Number(prices_another.one_main_token_cost_in_interim)} ${interim_token.symbol}`,
    })

    console.log("\nDEX price")
    console.table({
        'Main Token Price Before': `1 ${main_token.symbol} = ${Number(ethers.utils.formatUnits(new_main_token_price_before, token_to_receive.decimals))} ${interim_token.symbol}`,
        'Main Token Price After': `1 ${main_token.symbol} = ${Number(ethers.utils.formatUnits(new_main_token_price_after, token_to_receive.decimals))} ${interim_token.symbol}`,
        'Main Token Price On Other Dex': `1 ${main_token.symbol} = ${Number(ethers.utils.formatUnits(new_main_token_price_other, token_to_receive.decimals))} ${interim_token.symbol}`,
    })
}

const init = async () => {
    const provider =
        getProvider();
    console.log("provider - done");

    const dex_1 =
        getDex1(provider);
    console.log("dex 1 - done");

    const dex_2 =
        getDex2(provider);
    console.log("dex 2 - done");

    const main_token =
        await getMainToken(provider);
    console.log("main token - done");

    const interim_token =
        await getInterimToken(provider);
    console.log("interim token - done");

    const dex_1_pair_contract =
        await getPairContract(
            dex_1.Factory,
            main_token.address,
            interim_token.address,
            provider
        );
    console.log("dex 1 pair contract - done");

    const dex_2_pair_contract =
        await getPairContract(
            dex_2.Factory,
            main_token.address,
            interim_token.address,
            provider
        );

    console.log("dex 2 pair contract - done");

    return {
        main_token,
        interim_token,
        dex_1,
        dex_2,
        dex_1_pair_contract,
        dex_2_pair_contract
    }
}

const swap = async (
    dex,
    token_to_swap,
    token_to_receive,
    wallet_to_impersonate,
    token_amount_to_swap
) => {

    console.table({
        'Token to swap/dump/interim token': token_to_swap.symbol,
        'Token to receive/main token': token_to_receive.symbol,
        'Swapping on': dex.Name,
    })

    // convert units to wei
    const token_amount_to_swap_in_wei =
        ethers.utils.parseUnits(
            token_amount_to_swap,
            token_to_swap.decimals
        );

    console.log(`tokens to swap in wei => ${token_amount_to_swap_in_wei}`)

    // 10 minutes
    const deadline =
        Math.floor(Date.now() / 1000) + 60 * 10;

    // 1st element => token to swap
    // 2nd element => token to reveive
    const token_swap_path = [
        token_to_swap.contract.address,
        token_to_receive.contract.address
    ]

    console.log(`\nImpersonating account ${wallet_to_impersonate}`)

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [wallet_to_impersonate],
    })

    const impersonated_account =
        await hre.ethers.getSigner(wallet_to_impersonate);

    console.log(`Account ${impersonated_account.address} impersonated successfully`)

    // approve the amount of tokens to be swapped by the router
    await token_to_swap.contract
        .connect(impersonated_account)
        .approve(
            dex.Router.address,
            token_amount_to_swap_in_wei
        )

    console.log(`Router approved successfully`)

    // swap tokens
    await dex.Router
        .connect(impersonated_account)
        .swapExactTokensForTokens(
            token_amount_to_swap_in_wei,
            0,
            token_swap_path,
            impersonated_account.address,
            deadline
        )

    console.log(`Token swapped\n`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

