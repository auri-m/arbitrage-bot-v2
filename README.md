

npx hardhat node

npx hardhat compile

npx hardhat run scripts/deploy_BalancerV2.js --network localhost
npx hardhat run scripts/execute_swap_hre.js --network localhost


npx hardhat test --grep requestLoanAndExecuteTrade