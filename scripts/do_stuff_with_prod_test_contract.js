require("dotenv").config()
const { 
    ethers 
} = require("ethers")
const fs = 
    require("fs")
const path = 
    require("path")
const IERC20 = 
    require('@openzeppelin/contracts/build/contracts/ERC20.json')

const contract_address = "0xe4d158570D4432c935EBA18eBf55F1e67b2203dc"
const main_token_address = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const interim_token_address = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";


const main = async () => {

    const provider = 
        new ethers.providers.WebSocketProvider(process.env.WSS_ENDPOINT)
    const wallet = 
        new ethers.Wallet(process.env.PRIVATE_KEY);
    const signer = 
        wallet.connect(provider);
    const contract_abi = 
        getContractAbi();
    const contract = 
        new ethers.Contract(
            contract_address, 
            contract_abi, 
            signer
        );


    await logOwnerAndVersion(contract);

    await checkContractTokenBalance(
        contract_address, 
        main_token_address, 
        provider
    );

    // console.log("\nSWAP STARTING...\n")

    // await swap(
    //     provider,
    //     contract,
    //     signer,
    //     main_token_address,
    //     interim_token_address
    // )

    // console.log("\nSWAP DONE...\n")

    // await checkContractTokenBalance(
    //     contract_address, 
    //     main_token_address, 
    //     provider
    // );



    // await withdrawTokensFromContract(
    //     contract, 
    //     main_token_address, 
    //     signer,
    //     provider
    // )   


    // await checkContractTokenBalance(
    //     contract_address, 
    //     main_token_address, 
    //     provider
    // );
}

const getContractAbi = () => {
    const local_path_to_abi = "../artifacts/contracts/TestSwap.sol/TestSwap.json";
    const full_path_to_abi = path.resolve(__dirname, local_path_to_abi);

    const file = fs.readFileSync(full_path_to_abi, "utf8")
    const json = JSON.parse(file)

    return json.abi;
}

const logOwnerAndVersion = async (contract) => {
    const owner = 
        await contract.getOwner();
    const version = 
        await contract.getVersion();

    console.log(`\ncontract owner => ${owner}`);
    console.log(`contract version => ${version}`);
}

const withdrawTokensFromContract = async (
    contract, 
    token_address, 
    owner, 
    provider
) => {
    const fee_data = 
        await provider.getFeeData();

    await contract
        .connect(owner)
        .withdrawToken(token_address, { gasPrice: fee_data.gasPrice });
}

const checkContractTokenBalance = async (
    contract_address, 
    token_address, 
    provider
) => {

    const token_contract = 
        new ethers.Contract(
            token_address, 
            IERC20.abi, 
            provider
        )

    const balance_in_wei = 
        await token_contract.balanceOf(contract_address)
    
    console.log(`\ntoken balance => ${ethers.utils.formatUnits(balance_in_wei, "ether")}`)
}

const swap = async (
    provider,
    contract,
    account,
    main_token_address,
    interim_token_address
) => {

    // 1 WMATIC
    const loan_amount = ethers.utils.parseUnits("1", "ether");

    const router_address_to_buy = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
    const router_address_to_sell = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";

    const fee_data =
        await provider.getFeeData();

    const transaction =
        await contract
            .connect(account)
            .doTest(
                router_address_to_buy,
                router_address_to_sell,
                main_token_address,
                interim_token_address,
                loan_amount,
                {
                    gasPrice: fee_data.gasPrice
                }
            )

    const result =
        await transaction.wait()

    const event = result.events
        .find(event => event.event === 'ProfitableTransactionOccurred');

    const [
        mainTokenBalanceBefore,
        mainTokenBalanceAfter
    ] = event.args;

    console.log("Trade Complete")
    console.log(`   Transaction log => token balance BEFORE: ${ethers.utils.formatUnits(mainTokenBalanceBefore, "ether")}`)
    console.log(`   Transaction log => token balance AFTER: ${ethers.utils.formatUnits(mainTokenBalanceAfter, "ether")}`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log("error")
        console.error(error);
        process.exit(1);
    });