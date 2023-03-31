require("dotenv")
    .config()

const hre = 
    require("hardhat")

const{
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
    calculatePrice
} = require('../helpers/token-service')

const default_decimals = 18;

const main = async () => {

    // initialize
    const {
        main_token,
        interim_token,
        dex_1,
        dex_2,
        dex_1_pair_contract,
        dex_2_pair_contract
    } = await init();
    
    // some variable mapping to make the logic clearer
    const dex_to_swap = dex_1
    const dex_to_swap_pair_contract = dex_1_pair_contract;
    const token_to_swap = interim_token;
    const token_to_receive = main_token;
    const wallet_to_impersonate = "0x509db14ae32a43b98c6427bea50d0915c38c0196";
    const token_amount_to_swap = "10000";

    const price_before_swap = 
        await calculatePrice(dex_to_swap_pair_contract)

    // swap
    await swap(
        dex_to_swap, 
        token_to_swap, 
        token_to_receive,
        wallet_to_impersonate, 
        token_amount_to_swap
    )

    const price_after_swap = 
        await calculatePrice(dex_to_swap_pair_contract)
    
    // resulting price difference
    console.table({
        'Price Before': `1 ${token_to_receive.symbol} = ${Number(price_before_swap).toFixed()} ${token_to_swap.symbol}`,
        'Price After': `1 ${token_to_receive.symbol} = ${Number(price_after_swap).toFixed()} ${token_to_swap.symbol}`,
    })  
}

const init = async() => {
    const provider = 
        getProvider();
    const dex_1 = 
        getDex1(provider);
    const dex_2 = 
        getDex2(provider);
    const main_token = 
        await getMainToken(provider);
    const interim_token = 
        await getInterimToken(provider);
    const dex_1_pair_contract = 
        await getPairContract(
            dex_1.Factory, 
            main_token.address, 
            interim_token.address, 
            provider
        );
    const dex_2_pair_contract = 
        await getPairContract(
            dex_2.Factory, 
            main_token.address, 
            interim_token.address, 
            provider
        );
    
    return {
        main_token,
        interim_token,
        dex_1,
        dex_2,
        dex_1_pair_contract,
        dex_2_pair_contract
    }
}

const swap = async(
    dex, 
    token_to_swap, 
    token_to_receive,
    wallet_to_impersonate, 
    token_amount_to_swap
) => {

    console.table({
        'Token to swap': token_to_swap.symbol,
        'Token to receive': token_to_receive.symbol,
        'Swapping on': dex.Name,
    })  

    // confirm the wallet has the amount to swap and also some native currency
    const token_amount_to_swap_in_wei = 
        ethers.utils.parseUnits(
            token_amount_to_swap, 
            default_decimals
        );

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

