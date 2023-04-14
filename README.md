

npx hardhat node

npx hardhat compile

npx hardhat run scripts/deploy_BalancerV2.js --network localhost
npx hardhat run scripts/deploy_TestSwap.js --network localhost

npx hardhat run scripts/dump_tokens_hre.js --network localhost

node scripts/check_balance_ethers

npx hardhat test --grep requestLoanAndExecuteTrade