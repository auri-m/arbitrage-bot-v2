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

const contract_address = "0x1f720E7952650ED8Ca142feBD52aCBe8b7A21741";
const token_address = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"

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

    // await logOwnerAndVersion(contract);

    await checkContractTokenBalance(contract_address, token_address, provider);
}

const getContractAbi = () => {
    const local_path_to_abi = "../artifacts/contracts/BalancerV2.sol/BalancerV2.json";
    const full_path_to_abi = path.resolve(__dirname, local_path_to_abi);

    const file = fs.readFileSync(full_path_to_abi, "utf8")
    const json = JSON.parse(file)

    return json.abi;
}

const logCode = async (provider) => {
    const contract_code = 
        await provider.getCode(contract_address);
    console.log("Contract code");
    console.log(contract_code);
}

const logOwnerAndVersion = async (contract) => {
    const owner = 
        await contract.getOwner();
    const version = 
        await contract.getVersion();

    console.log(`\ncontract owner => ${owner}`);
    console.log(`contract version => ${version}`);
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
    
    console.log(`Balance => ${ethers.utils.formatUnits(balance_in_wei, "ether")}`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log("error")
        console.error(error);
        process.exit(1);
    });