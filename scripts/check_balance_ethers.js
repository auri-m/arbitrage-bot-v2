require("dotenv").config()
const { 
    ethers 
} = require("ethers")
const fs = 
    require("fs")
const path = 
require("path")

const contract_address = "0x9e7F7d0E8b8F38e3CF2b3F7dd362ba2e9E82baa4";

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

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log("error")
        console.error(error);
        process.exit(1);
    });