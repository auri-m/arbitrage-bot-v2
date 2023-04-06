const { 
    ethers 
} = require("ethers")
const config = 
    require('../config.json')
const fs = 
    require("fs")
const path = 
    require("path")

const getArbitrageContract = provider => {
    const conract_abi = 
        getContractAbi();
    return new ethers.Contract(
        config.ContractAddress, 
        conract_abi, 
        provider
    );
}

const getContractAbi = () => {
    const local_path_to_abi = 
        "../artifacts/contracts/BalancerV2.sol/BalancerV2.json";
    const full_path_to_abi = 
        path.resolve(__dirname, local_path_to_abi);
    const file = 
        fs.readFileSync(full_path_to_abi, "utf8")
    const json = 
        JSON.parse(file)

    return json.abi;
}

module.exports = {
    getArbitrageContract
}