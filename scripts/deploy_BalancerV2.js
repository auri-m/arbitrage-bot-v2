const hre = require("hardhat");

const balancer_vault_on_polygon = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
const version = "1.02 (alpha)";

const main = async () => {

  try {
    console.log(`Preparing deployment...\n`)

    const contract_factory =
      await hre.ethers.getContractFactory("BalancerV2")

    const contract_promise =
      await contract_factory.deploy(
        balancer_vault_on_polygon,
        version
      );

    console.log(`Deploying...\n`)

    await contract_promise.deployed();

    console.log(`Deployed to ${contract_promise.address}`);

  } catch (error) {
    console.log(error)
  }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });