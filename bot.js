require('./helpers/globals')
require("dotenv").config();
require('./helpers/host-process')

const config = 
  require('./config.json')

const {
  ethers
} = require("ethers")

const {
  getProvider
} = require('./helpers/provider-factory')

const {
  getDex1,
  getDex2
} = require('./helpers/dex-factory')

const {
  getMainToken,
  getInterimToken
} = require('./helpers/token-factory')

const {
  getPairContract,
  getReserves,
  estimateMainTokenProfit,
  pickArbitrageAmount,
  getTokenIndexInsidePair,
  determinePotentialTradeOrder,
  calculatePriceDifferencePercentage
} = require('./helpers/token-service')

const {
  getArbitrageContract
} = require('./helpers/contract-factory')

const {
  getAccount
} = require('./helpers/account-factory')

const {
  logError,
  logInfo
} = require('./helpers/log-service');

const _min_price_difference_percentage = 
  config.Constraints.MinPriceDifferencePercentage;

let isExecuting = false

const main = async () => {

  logCurrentConfig()

  const provider =
    getProvider();
  const contract =
    getArbitrageContract(provider);
  const account = 
    getAccount(provider)

  const dex_1 =
    getDex1(provider);
  const dex_2 =
    getDex2(provider);

  const token0 =
    await getMainToken(provider);
  const token1 =
    await getInterimToken(provider);

  const dex_1_pair_contract =
    await getPairContract(
      dex_1.Factory,
      token0.address,
      token1.address,
      provider
    )
  const dex_2_pair_contract =
    await getPairContract(
      dex_2.Factory,
      token0.address,
      token1.address,
      provider
    )

  token0.index_Inside_Dex1_Pair =
    await getTokenIndexInsidePair(
      dex_1_pair_contract,
      token0.address
    );

  token1.index_Inside_Dex1_Pair =
    await getTokenIndexInsidePair(
      dex_1_pair_contract,
      token1.address
    );

  token0.index_Inside_Dex2_Pair =
    await getTokenIndexInsidePair(
      dex_2_pair_contract,
      token0.address
    );

  token1.index_Inside_Dex2_Pair =
    await getTokenIndexInsidePair(
      dex_2_pair_contract,
      token1.address
    );

  const main_token_runtime_data = {
    type: "main-token-runtime-data",
    token_config_name: token0.configName,
    token_address: token0.address,
    token_symbol: token0.symbol,
    token_name: token0.name,
    token_index_in_dex1_pair: token0.index_Inside_Dex1_Pair,
    token_index_in_dex2_pair: token0.index_Inside_Dex2_Pair
  }
  logInfo(main_token_runtime_data)
  console.table(main_token_runtime_data)

  const interim_token_runtime_data = {
    type: "interim-token-runtime-data",
    token_config_name: token1.configName,
    token_address: token1.address,
    token_symbol: token1.symbol,
    token_name: token1.name,
    token_index_in_dex1_pair: token1.index_Inside_Dex1_Pair,
    token_index_in_dex2_pair: token1.index_Inside_Dex2_Pair
  }
  logInfo(interim_token_runtime_data)
  console.table(interim_token_runtime_data)

  const dex_runtime_data = {
    type: "dex-runtime-data",
    dex_1_name: dex_1.Name,
    dex_1_pair_address: dex_1_pair_contract.address,
    dex_2_name: dex_2.Name,
    dex_2_pair_address: dex_2_pair_contract.address,
  }
  logInfo(dex_runtime_data)
  console.table(dex_runtime_data)

  dex_1_pair_contract.on('Swap', async (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
    if (!isExecuting) {

      isExecuting = true

      const swap_event = {
        type: "swap-event",
        origin_dex: dex_1.Name
      }
      logInfo(swap_event)
      console.table(swap_event)

      await checkArbitrage(
        dex_1,
        dex_2,
        dex_1_pair_contract,
        dex_2_pair_contract,
        token0,
        token1,
        account,
        contract
      )

      isExecuting = false
    } else {
      console.log("isExecuting => true")
    }
  })

  dex_2_pair_contract.on('Swap', async (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
    if (!isExecuting) {

      isExecuting = true

      const swap_event = {
        type: "swap-event",
        origin_dex: dex_2.Name
      }
      logInfo(swap_event)
      console.table(swap_event)

      await checkArbitrage(
        dex_1,
        dex_2,
        dex_1_pair_contract,
        dex_2_pair_contract,
        token0,
        token1,
        account,
        contract
      )

      isExecuting = false
    } else {
      console.log("isExecuting => true")
    }
  })

  const initialization_complete = {
    type: "initialization-complete"
  }
  logInfo(initialization_complete)
  console.log("Waiting for swap event...")
}

const checkArbitrage = async (
  dex_1,
  dex_2,
  dex_1_PairContract,
  dex_2_PairContract,
  token0,
  token1,
  account,
  contract
) => {

  const price_difference_percentage =
    await checkPriceDifference(
      dex_1_PairContract,
      dex_2_PairContract,
    )

  const potential_trade_order =
    await determinePotentialTradeOrder(
      price_difference_percentage,
      _min_price_difference_percentage,
      dex_1,
      dex_2
    )

  if (!potential_trade_order.TradeOrderAvailable) {

    const entry = {
      type: "arbitrage",
      data_1: "no arbitrage (no trade path)",
      data_2: price_difference_percentage
    }
    logInfo(entry)

    console.log(`No Arbitrage (No Trade Path) Currently Available\n`)
    console.log(`-----------------------------------------\n`)
    isExecuting = false
    return
  }

  const entry = {
    type: "arbitrage",
    data_1: "trade order",
    dex_to_buy: potential_trade_order.DexToBuy.Name,
    dex_to_sell: potential_trade_order.DexToSell.Name
  }
  logInfo(entry)

  console.log(`\nDEX to buy => ${potential_trade_order.DexToBuy.Name}`)
  console.log(`DEX to sell => ${potential_trade_order.DexToSell.Name}`)


  const estimated_gas_cost =
    getEstimatedGasCost();

  const {
    command_executed_successfully,
    estimated_profit,
    main_token_amount_required_to_buy
  } = await determineProfit(
    potential_trade_order.DexToBuy,
    potential_trade_order.DexToSell,
    dex_1,
    dex_2,
    dex_1_PairContract,
    dex_2_PairContract,
    token0,
    token1,
    account,
    estimated_gas_cost
  )

  if (!command_executed_successfully) {

    const entry = {
      type: "arbitrage",
      data_1: "no arbitrage (profit estimate failed)"
    }
    logInfo(entry)

    console.log(`No Arbitrage (Profit Estimate Failed) Currently Available\n`)
    console.log(`-----------------------------------------\n`)
    isExecuting = false
    return
  }

  if (estimated_profit < 0) {

    const entry = {
      type: "arbitrage",
      data_1: "no arbitrage (no profit)",
      data_2: estimated_profit
    }
    logInfo(entry)

    console.log(`No Arbitrage (No Profit) Currently Available\n`)
    console.log(`-----------------------------------------\n`)
    isExecuting = false
    return
  }

  // Profitable trade
  if (config.Constraints.ExecuteTrades) {

    const entry = {
      type: "arbitrage",
      data_1: "executing trades is enabled"
    }
    logInfo(entry)

    console.log("Executing trades is enabled")

    // routerPath buvo router objektai
    await attemptArbitrage(
      account,
      contract,
      potential_trade_order.DexToBuy.Router.address,
      potential_trade_order.DexToSell.Router.address,
      token0,
      token1,
      main_token_amount_required_to_buy.toString()
    )

  } else {

    const entry = {
      type: "arbitrage",
      data_1: "executing trades is disabled"
    }
    logInfo(entry)

    console.log("Executing trades is disabled")
  }

}

const checkPriceDifference = async (
  dex1PairContract,
  dex2PairContract,
) => {

  const price_difference_percentage =
    await calculatePriceDifferencePercentage(dex1PairContract, dex2PairContract);

  const entry = {
    type: "arbitrage",
    data_1: "check price result",
    price_difference_percentage: price_difference_percentage

  }
  logInfo(entry)

  console.log(`\nPrice difference: ${price_difference_percentage}`)

  return price_difference_percentage
}

const determineProfit = async (
  dex_to_buy,
  dex_to_sell,
  dex_1,
  dex_2,
  dex_1_PairContract,
  dex_2_PairContract,
  token0,
  token1,
  account,
  estimated_gas_cost
) => {

  console.log(`Determining Profitability...\n`)

  let token1_reserves_on_dex_to_buy = null;
  let token1_reserves_on_dex_to_sell = null;
  let token1_amount_for_arbitrage = null;

  // Get interim token reserves on both DEXes
  if (dex_to_buy.Name == dex_1.Name) {

    // DEX 1 is the dex to buy 
    const reserves_on_dex_to_buy = 
      await getReserves(dex_1_PairContract)
    const reserves_on_dex_to_sell = 
      await getReserves(dex_2_PairContract)

    token1_reserves_on_dex_to_buy = 
      reserves_on_dex_to_buy[token1.index_Inside_Dex1_Pair]
    token1_reserves_on_dex_to_sell = 
      reserves_on_dex_to_sell[token1.index_Inside_Dex2_Pair]

  } else if (dex_to_buy.Name == dex_2.Name) {

    // DEX 2 is the dex to buy 
    const reserves_on_dex_to_buy = 
      await getReserves(dex_2_PairContract)
    const reserves_on_dex_to_sell = 
      await getReserves(dex_1_PairContract)

    token1_reserves_on_dex_to_buy = 
      reserves_on_dex_to_buy[token1.index_Inside_Dex2_Pair]
    token1_reserves_on_dex_to_sell = 
      reserves_on_dex_to_sell[token1.index_Inside_Dex1_Pair]

  } else {
    // weird shit
    throw "cannot determine DEXes to get token reserves";
  }

  // amount available for arbitrage is the lowest reserve
  token1_amount_for_arbitrage = 
    pickArbitrageAmount(
      token1_reserves_on_dex_to_buy,
      token1_reserves_on_dex_to_sell
    )

  const profitability_data_1 = {
    type: "arbitrage",
    data_1: "profitability data 1",
    dex_to_buy: dex_to_buy.Name,
    interim_token_amount_on_dex_to_buy: ethers.utils.formatUnits(token1_reserves_on_dex_to_buy, 'ether'),
    dex_to_sell: dex_to_sell.Name,
    interim_token_amount_on_dex_to_sell: ethers.utils.formatUnits(token1_reserves_on_dex_to_sell, 'ether'),
    interim_token_amount_for_arbitrage: ethers.utils.formatUnits(token1_amount_for_arbitrage, 'ether'),
  }
  logInfo(profitability_data_1)

  console.table(profitability_data_1)

  try {

    // getAmountsIn(amountOut, [TOKEN_0, TOKEN_1])
    // given the "amountOut" value of TOKEN_1, this function will tell us how many TOKEN_0 we need
    // shows how many TOKEN_0 we need in order to get the "amountOut" of TOKEN_1

    // dex's kuriame pirksim
    // paduodam amount'a kuri norim gauti (amountOut)
    // pirmas elementas -> tokenas kuri norim moket/ikelt (token0 == main token == WETH)
    // antras elementas -> tokenas kuri norim gaut (token1 == interim token == SHIB)

    const amountsOnDexToBuy = await dex_to_buy.Router.getAmountsIn(
      token1_amount_for_arbitrage,
      [token0.address, token1.address]
    )
    const token0_amount_required_to_buy_token1_on_dex_to_buy = 
      amountsOnDexToBuy[0];
    const token1_amount_available_on_dex_to_buy = 
      amountsOnDexToBuy[1];

    // getAmountsOut(amountIn, [TOKEN_0, TOKEN_1])
    // given the "amountIn" value of TOKEN_0, this function will tell us how many TOKEN_1 we receive
    // shows how many TOKEN_1 we get from "amountIn" of TOKEN_0

    // dex's kuriame parduosim
    // paduodam amount'a kuri turim (amountIn)
    // pirmas elementas -> tokenas kuri norim moket (token1 == interim token == SHIB)
    // antras elementas -> tokenas kuri norim gaut (token0 == main token == WETH)

    const amountsOnDexToSell = await dex_to_sell.Router.getAmountsOut(
      token1_amount_available_on_dex_to_buy,
      [token1.address, token0.address]
    )
    const token1_amount_available_to_sell_on_dex_to_sell = 
      amountsOnDexToSell[0]
    const token0_amount_received_on_dex_to_sell = 
      amountsOnDexToSell[1]

    const profitability_data_2 = {
      type: "arbitrage",
      data_1: "profitability data 2",
      interim_token_available_to_buy: token1_amount_available_on_dex_to_buy,
      main_token_amount_needed: ethers.utils.formatUnits(token0_amount_required_to_buy_token1_on_dex_to_buy.toString(), 'ether'),
      main_token_estimated_return: ethers.utils.formatUnits(token0_amount_received_on_dex_to_sell.toString(), 'ether')
    }
    logInfo(profitability_data_2)

    console.log(`Estimated amount of ${token0.symbol} needed to buy ${token1_amount_available_on_dex_to_buy} ${token1.symbol} on ${dex_to_buy.Name}\t\t|${ethers.utils.formatUnits(token0_amount_required_to_buy_token1_on_dex_to_buy.toString(), 'ether')}`)
    console.log(`Estimated amount of ${token0.symbol} returned after swapping ${token1_amount_available_on_dex_to_buy} ${token1.symbol} on ${dex_to_sell.Name}\t|${ethers.utils.formatUnits(token0_amount_received_on_dex_to_sell.toString(), 'ether')}\n`)

    const estimated_profit = await estimateMainTokenProfit(
      token0_amount_required_to_buy_token1_on_dex_to_buy,
      dex_to_buy,
      dex_to_sell,
      token0,
      token1
    )

    // estimated transaction costs
    const native_coin_balance_before_transaction = 
      ethers.utils.formatUnits(await account.getBalance(), 'ether')
    const native_coin_balance_after_transaction = 
      native_coin_balance_before_transaction - estimated_gas_cost

    // estimated main token profits
    const token0_wallet_balance_before = 
      Number(ethers.utils.formatUnits(await token0.contract.balanceOf(account.address), 'ether'))
    const token0_wallet_balance_after = 
      estimated_profit + token0_wallet_balance_before
    const token0_wallet_balance_difference = 
      token0_wallet_balance_after - token0_wallet_balance_before

    const profitability_data_3 = {
      type: "arbitrage",
      data_1: "profitability data 3",
      native_coin_balance_before: native_coin_balance_before_transaction,
      native_coin_balance_after: native_coin_balance_after_transaction,
      transaction_cost: estimated_gas_cost,
      estimated_profit: estimated_profit,
      main_token_balance_before: token0_wallet_balance_before,
      main_token_balance_after: token0_wallet_balance_after,
      main_token_gained_lost: token0_wallet_balance_difference
    }
    logInfo(profitability_data_3)

    const log_data = {
      "Native Coin Balance Before": native_coin_balance_before_transaction,
      "Native Coin Balance After": native_coin_balance_after_transaction,
      "Transaction Cost": estimated_gas_cost,
      "-": {},
      "Main Token Balance Before": token0_wallet_balance_before,
      "Main Token Balance After": token0_wallet_balance_after,
      "Main Token Gained/Lost": token0_wallet_balance_difference,
    }
    console.table(log_data)
    console.log()

    return {
      command_executed_successfully: true,
      estimated_profit,
      main_token_amount_required_to_buy: token0_amount_required_to_buy_token1_on_dex_to_buy
    }
  } catch (error) {

    logError(error)
    console.log(error)

    return {
      command_executed_successfully: false,
      estimated_profit: 0,
      main_token_amount_required_to_buy: 0
    }
  }
}

const attemptArbitrage = async (
  account,
  contract,
  router_address_to_buy,
  router_address_to_sell,
  main_token,
  interim_token,
  loan_amount
) => {

  console.log("Attempting Trade...\n")

  // balances before trade
  const contract_main_token_balance_before_trade_in_wei = 
    await main_token.contract.balanceOf(contract.address)
  const account_balance_before_trade_in_wei = 
    await account.getBalance()

  const transaction = 
    await contract
      .connect(account)
      .requestLoanAndExecuteTrade(
        router_address_to_buy,
        router_address_to_sell,
        main_token.address,
        interim_token.address,
        loan_amount
      )

  await transaction.wait()

  console.log("Trade Complete\n")

  // balances after trade
  const contract_main_token_balance_after_trade_in_wei = 
    await main_token.contract.balanceOf(contract.address)
  const account_balance_after_trade_in_wei = 
    await account.getBalance()
  
  // main token stats
  const contract_main_token_balance_before_trade = 
    ethers.utils.formatUnits(
      contract_main_token_balance_before_trade_in_wei, 
      "ether"
    );
  const contract_main_token_balance_after_trade = 
    ethers.utils.formatUnits(
      contract_main_token_balance_after_trade_in_wei, 
      "ether"
    );
  const contract_main_token_difference = 
    Number(contract_main_token_balance_after_trade) - Number(contract_main_token_balance_before_trade)

  // native coint stats
  const account_balance_before_trade = 
    ethers.utils.formatUnits(
      account_balance_before_trade_in_wei, 
      "ether"
    );
  const account_balance_after_trade = 
    ethers.utils.formatUnits(
      account_balance_after_trade_in_wei, 
      "ether"
    );
  const transaction_cost = 
    Number(account_balance_before_trade) - Number(account_balance_after_trade)

  const trade_stats = {
    type: "arbitrage",
    data_1: "trade",
    contract_main_token_balance_before_trade: contract_main_token_balance_before_trade,
    contract_main_token_balance_after_trade: contract_main_token_balance_after_trade,
    contract_main_token_difference: contract_main_token_difference,
    account_balance_before_trade: account_balance_before_trade,
    account_balance_after_trade: account_balance_after_trade,
    transaction_cost: transaction_cost
  }
  logInfo(trade_stats)

  const log_data = {
    "Native Coin Balance Before": account_balance_before_trade,
    "Native Coin Balance After": account_balance_after_trade,
    "Transaction Cost": transaction_cost,
    "-": {},
    "Main Token Balance Before": contract_main_token_balance_before_trade,
    "Main Token Balance After": contract_main_token_balance_after_trade,
    "Main Token Gained/Lost": contract_main_token_difference
  }
  console.table(log_data)
}


const getEstimatedGasCost = () => {
  const ignoreGas = config.Constraints.IgnoreGas;
  if (ignoreGas)
    return 0

  const gasLimit = config.Constraints.GasLimit;
  const gasPrice = config.Constraints.GasPrice;

  return gasLimit * gasPrice
}

const logCurrentConfig = () => {
  logInfo({
    type: "static-config",
    port: config.Port,
    chain: config.Chain,
    contract_address: config.ContractAddress,
    main_token_name: config.MainToken.Name,
    main_token_address: config.MainToken.Address,
    interim_token_name: config.InterimToken.Name,
    interim_token_address: config.InterimToken.Address,
    dex_1_name: config.Dex_1.Name,
    dex_1_router: config.Dex_1.RouterAddress,
    dex_1_factory: config.Dex_1.FactoryAddress,
    dex_2_name: config.Dex_2.Name,
    dex_2_router: config.Dex_2.RouterAddress,
    dex_2_factory: config.Dex_2.FactoryAddress,
    constraints_execute_trades: config.Constraints.ExecuteTrades,
    constraints_min_price_difference_percentage: config.Constraints.MinPriceDifferencePercentage,
    constraints_ignore_gas: config.Constraints.IgnoreGas,
    constraints_gas_limit: config.Constraints.GasLimit,
    constraints_gas_price: config.Constraints.GasPrice
  })
}

main().catch((error) => {
  console.log("Main error caught")
  console.log(error)
  logError(error);
});