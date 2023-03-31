require("dotenv")
    .config()

const config = 
    require('../config.json')

const IERC20 = 
    require('@openzeppelin/contracts/build/contracts/ERC20.json')

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
    getReserves,
} = require('../helpers/token-service')

const main = async () => {

    console.log("\nStarting validation\n")

    const provider = 
        await check_provider();

    await check_dex_1(provider);

    await check_dex_2(provider);

    await check_main_token(provider);

    await check_interim_token(provider);

    await check_token_pair_on_dex_1(provider);

    await check_token_pair_on_dex_2(provider);

    //todo 
    //validate contract 

    console.log("\n\nConfig's valid\n")
}

const check_provider = async () => {

    console.log("\n\tchecking provider...")

    const provider = 
        getProvider();
    const network =
        await provider.getNetwork();

    if(!provider)
        throw "Provider not found"
    if(!network)
        throw "Network not found"

    console.log("\tprovider valid")

    return provider;
}

const check_dex_1 = async provider => {

    console.log("\n\tchecking dex 1...")

    const dex = 
        getDex1(provider);
    
    await check_dex(
        dex, 
        provider
    );

    console.log("\tdex 1 valid")
}

const check_dex_2 = async provider => {

    console.log("\n\tchecking dex 2...")

    const dex = 
        getDex2(provider);
    
    await check_dex(
        dex, 
        provider
    );
    
    console.log("\tdex 2 valid")
}

const check_dex = async (dex, provider) => {

    const factory_code = 
        await provider.getCode(dex.Factory.address);

    if(!factory_code)
        throw "Factory not found"

    if(factory_code.length < 5)
        throw "Factory has not code"
    
    const router_code = 
        await provider.getCode(dex.Router.address);

    if(!router_code)
        throw "Router not found"
        
    if(router_code.length < 5)
        throw "Router has not code"
}


const check_main_token = async provider => {

    console.log("\n\tchecking main token...")

    const main_token = 
        await getMainToken(provider);
    
    await check_token(
        main_token, 
        provider
    );
    
    console.log("\tmain token valid")
}

const check_interim_token = async provider => {

    console.log("\n\tchecking interim token...")

    const interim_token = 
        await getInterimToken(provider);
    
    await check_token(
        interim_token, 
        provider
    );
    
    console.log("\tinterim token valid")
}

const check_token = async (token, provider) => {

    if(!token)
        throw "Token not found"

    if(!token.symbol)
        throw "Token symbol not found"
    
    if(token.symbol.length < 1)
        throw "Token symbol empty"

    if(!token.name)
        throw "Token name not found"
    
    if(token.name.length < 1)
        throw "Token name empty"
        
    if(token.contract.address.length < 1)
        throw "Token address empty"
        
    const token_code = 
        await provider.getCode(token.contract.address);

    if(!token_code)
        throw "Token code not found"
        
    if(token_code.length < 5)
        throw "Token code empty"
}

const check_token_pair_on_dex_1 = async (provider) => {

    console.log("\n\tchecking token pair on dex 1...")

    const dex = 
        getDex1(provider);
    const main_token = 
        await getMainToken(provider);
    const interim_token = 
        await getInterimToken(provider);
    
    await check_token_pair_on_dex(
        dex, 
        main_token,
        interim_token,
        provider
    );
    
    console.log("\ttoken pair on dex 1 valid")
}

const check_token_pair_on_dex_2 = async (provider) => {
    console.log("\n\tchecking token pair on dex 2...")

    const dex = 
        getDex2(provider);
    const main_token = 
        await getMainToken(provider);
    const interim_token = 
        await getInterimToken(provider);
    
    await check_token_pair_on_dex(
        dex, 
        main_token,
        interim_token,
        provider
    );
    
    console.log("\ttoken pair on dex 2 valid")
}

const check_token_pair_on_dex = async (
    dex, 
    main_token,
    interim_token,
    provider
) => {

    const dex_pair_contract = 
        await getPairContract(
            dex.Factory, 
            main_token.address, 
            interim_token.address, 
            provider
        );

    if(!dex_pair_contract.address)
        throw "Pair address not found"

    const pair_code = 
        await provider.getCode(dex_pair_contract.address);
    
    if(!pair_code)
        throw "Pair code not found"
        
    if(pair_code.length < 5)
        throw "Pair code empty"

    const reserves = 
        await getReserves(dex_pair_contract)
    
    if(!reserves)
        throw "Pair reserves not found"
    
    if(!reserves[0])
        throw "Pair reserve first token not found"

    if(Number(reserves[0]) == 0)
        throw "Pair reserve first token amount 0"
    
    if(!reserves[1])
        throw "Pair reserve second token not found"

    if(Number(reserves[1]) == 0)
        throw "Pair reserve second token amount 0"    
}
    

    



main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log("\n VALIDATION FAILED \n")
        console.error(error);
        process.exit(1);
    });
