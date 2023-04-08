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

const contract_address = "0x3c2866813A5aFac211d127B2629820EC90aA79C8";
const token_address = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"

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
        token_address, 
        provider
    );

    await checkNativeCoinBalance(
        contract_address, 
        provider
    );

    // await withdrawNativeCoinsFromContract(
    //     contract, 
    //     signer,
    //     provider
    // );

    // await withdrawTokensFromContract(
    //     contract, 
    //     token_address, 
    //     signer,
    //     provider
    // )   
}

const getContractAbi = () => {
    const local_path_to_abi = "../artifacts/contracts/BalancerV2.sol/BalancerV2.json";
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

const checkNativeCoinBalance = async (address, provider) => {

    const balance = 
        await provider.getBalance(address);
    const formated_balance = 
        ethers.utils.formatUnits(balance, "ether")

    console.log(`\nnative coin balance => ${formated_balance}`)
}

const withdrawNativeCoinsFromContract = async (
    contract, 
    owner, 
    provider
) => {

    const fee_data = 
        await provider.getFeeData();

    await contract
        .connect(owner)
        .withdraw({ gasPrice: fee_data.gasPrice });
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

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log("error")
        console.error(error);
        process.exit(1);
    });