const hre = require("hardhat");

const balancer_vault_on_polygon = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
const version = "1.01";

const main = async () => {

  console.log(`Preparing deployment...\n`)

  const contract_factory = 
    await hre.ethers.getContractFactory("BalancerV2")
  const contract_promise = 
    await contract_factory.deploy(
      balancer_vault_on_polygon, 
      version
    );
  await contract_promise.deployed();

  console.log(`deployed to ${contract_promise.address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });