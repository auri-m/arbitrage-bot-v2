require('./helpers/globals')
require("dotenv").config();
// require('./helpers/host-process')

const big =
  require('big.js')

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
  getTokenIndexInsidePair,
  determinePotentialTradeOrder,
  calculateMainTokenPriceDifferencePercentage,
  getDefaultArbitrageAmount,
  determineProfitForInterimTokenAmount
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

const MIN_MAIN_TOKEN_PROFIT = 
  config.Constraints.MinMainTokenProfit;

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


  console.log("\ndoing test 1...")

  const default_interim_token_amount =
  await getDefaultArbitrageAmount(
    dex_1,
    token0,
    token1
  )

  for(let i = 0; i < 100; i++) {

    const default_interim_token_amount_2 =
      await getDefaultArbitrageAmount(
        dex_1,
        token0,
        token1
      )

    await sleep(100);
      
    console.log(`iteration ${i} => ${default_interim_token_amount_2}`)
  }
  console.log("test 1 complete")


  console.log("\ndoing test 2...")
  const default_amount_profit =
    await determineProfitForInterimTokenAmount(
      token0.address,
      token1.address,
      default_interim_token_amount,
      dex_1,
      dex_2
    )
  console.log("test 2 complete")
  console.log(default_amount_profit)


  


  // dex_1_pair_contract.on('Swap', async (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
  //   if (!isExecuting) {

  //     isExecuting = true

  //     const swap_event = {
  //       type: "swap-event",
  //       origin_dex: dex_1.Name
  //     }
  //     logInfo(swap_event)
  //     console.table(swap_event)

  //     try{
  //       await checkArbitrage(
  //         dex_1,
  //         dex_2,
  //         dex_1_pair_contract,
  //         dex_2_pair_contract,
  //         token0,
  //         token1,
  //         account,
  //         contract,
  //         provider
  //       )
  //     }catch(error){
  //       console.log("\nSWAP HANDLER ERROR...\n")
  //       console.log(error)
  //       logError(error)
  //     }

  //     console.log("\nWaiting for swap event...")

  //     isExecuting = false
      
  //   } 
  // })

  // dex_2_pair_contract.on('Swap', async (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
  //   if (!isExecuting) {

  //     isExecuting = true

  //     const swap_event = {
  //       type: "swap-event",
  //       origin_dex: dex_2.Name
  //     }
  //     logInfo(swap_event)
  //     console.table(swap_event)

  //     try{
  //       await checkArbitrage(
  //         dex_1,
  //         dex_2,
  //         dex_1_pair_contract,
  //         dex_2_pair_contract,
  //         token0,
  //         token1,
  //         account,
  //         contract,
  //         provider
  //       )
  //     }catch(error){
  //       console.log("\nSWAP HANDLER ERROR...\n")
  //       console.log(error)
  //       logError(error)
  //     }

  //     console.log("\nWaiting for swap event...")

  //     isExecuting = false

  //   } 
  // })




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
  contract,
  provider
) => {

  const price_difference_percentage =
    await calculateMainTokenPriceDifferencePercentage(
      dex_1_PairContract,
      dex_2_PairContract,
      token0,
      token1
    );

  const log_entry = {
    type: "arbitrage",
    data_1: "check price result",
    price_difference_percentage: price_difference_percentage

  }
  logInfo(log_entry)
  console.log(`\nMain token price difference ${price_difference_percentage} %`)

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

    console.log(`No Arbitrage (No Trade Path) Currently Available`)
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

  console.log(`\nDEX to buy => \t${potential_trade_order.DexToBuy.Name}`)
  console.log(`DEX to sell => \t${potential_trade_order.DexToSell.Name}`)

  const {
    estimated_profit_after_final_sale,
    main_token_amount_required_to_buy_interim_tokens,
    interim_token_arbitrage_amount,
    token_ratio_used,
    message
  } = await determineDynamicProfit(
    potential_trade_order.DexToBuy,
    potential_trade_order.DexToSell,
    dex_1,
    dex_2,
    dex_1_PairContract,
    dex_2_PairContract,
    token0,
    token1
  )

  const entry1 = {
    type: "arbitrage",
    data_1: "estimated profit",
    interim_token_arbitrage_amount: ethers.utils.formatUnits(interim_token_arbitrage_amount, token1.decimals),
    estimated_profit_after_final_sale: ethers.utils.formatUnits(estimated_profit_after_final_sale.toString(), token0.decimals),
    token_ratio_used: token_ratio_used,
    message: message
  }
  logInfo(entry1)

  console.log(`\nEstimated profit from arbitraging:`);
  console.log(`   Buy ${ethers.utils.formatUnits(interim_token_arbitrage_amount, token1.decimals)} of ${token1.symbol} `)
  console.log(`   Profit after selling: ${ethers.utils.formatUnits(estimated_profit_after_final_sale.toString(), token0.decimals)} ${token0.symbol}`)
  console.log(`   Last profitable ratio: ${token_ratio_used}`)
  console.log(`   Message: ${message}\n`)

  // no profit
  if (estimated_profit_after_final_sale < 0) {

    const entry = {
      type: "arbitrage",
      data_1: "no arbitrage (no profit)",
      data_2: estimated_profit_after_final_sale
    }
    logInfo(entry)

    console.log(`No Arbitrage (No Profit) Currently Available\n`)
    console.log(`-----------------------------------------\n`)
    isExecuting = false

    return;
  }

  // not enough profit
  if (estimated_profit_after_final_sale < ethers.utils.parseUnits(MIN_MAIN_TOKEN_PROFIT, token0.decimals)) {

    const entry = {
      type: "arbitrage",
      data_1: "no arbitrage (not enough profit)",
      data_2: estimated_profit_after_final_sale
    }
    logInfo(entry)

    console.log(`No Arbitrage (Not Enough Profit) Currently Available`)
    console.log(`Min Profit is at least ${MIN_MAIN_TOKEN_PROFIT} ${token0.symbol}\n`)
    console.log(`-----------------------------------------\n`)
    isExecuting = false

    return;
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
      provider,
      potential_trade_order.DexToBuy.Router.address,
      potential_trade_order.DexToSell.Router.address,
      token0,
      token1,
      main_token_amount_required_to_buy_interim_tokens.toString()
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

const determineDynamicProfit = async (
  dex_to_buy,
  dex_to_sell,
  dex_1,
  dex_2,
  dex_1_PairContract,
  dex_2_PairContract,
  token0,
  token1
) => {

  // local state
  const state = {
    estimated_profit_after_final_sale: -1,
    main_token_amount_required_to_buy_interim_tokens: -1,
    interim_token_arbitrage_amount: -1,
    token_ratio_used: -1,
    message: ""
  };

  const update_local_state = (
    profit, 
    main_token_amount, 
    interim_token_amount, 
    ratio,
    message
  ) => {
    state.estimated_profit_after_final_sale = profit;
    state.main_token_amount_required_to_buy_interim_tokens = main_token_amount;
    state.interim_token_arbitrage_amount = interim_token_amount;
    state.token_ratio_used = ratio;
    state.message = message;
  }

  const set_local_state_message = 
    (message) => 
      state.message = message;

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

  console.log(`\nInterim token reserves on DEX TO BUY => \t${token1_reserves_on_dex_to_buy}`)
  console.log(`Interim token reserves on DEX TO SELL => \t${token1_reserves_on_dex_to_sell}`)

  // check default amount first
  const default_interim_token_amount =
    await getDefaultArbitrageAmount(
      dex_to_buy,
      token0,
      token1
    )

  // something failed
  if (!default_interim_token_amount) {
    set_local_state_message("Default arbitrage amount determination failed")
    return state;
  }

  const default_amount_profit =
    await determineProfitForInterimTokenAmount(
      token0.address,
      token1.address,
      default_interim_token_amount,
      dex_to_buy,
      dex_to_sell
    )

  // something failed during default amount check
  if (!default_amount_profit.success) {
    set_local_state_message("Default arbitrage amount profit determination failed")
    return state;
  }

  // if the default amount is not profitable, it's not worth continuing
  if (!default_amount_profit.profitable) {
    set_local_state_message("Default arbitrage amount not profitable")
    return state;
  }

  // if we reached this part
  // it means at least the default amount was profitable 
  // and we should save it
  update_local_state(
    default_amount_profit.profit, 
    default_amount_profit.main_token_amount_required_to_buy, 
    default_amount_profit.interim_token_amount_to_verify, 
    0,
    "Default arbitrage amount is profitable"
  )

  // from here 
  //    => 
  //        check other amounts to find the most profit

  const mid_ratio = 0.5;
  const higher_ratios = [0.6, 0.7, 0.8, 0.9]
  const lower_rations = [0.4, 0.3, 0.2, 0.1, 0.05, 0.025, 0.01]
  const interim_token_reserves_on_dex_to_buy = big(token1_reserves_on_dex_to_buy)

  const mid_reserve =
    interim_token_reserves_on_dex_to_buy.times(mid_ratio).round();

  const mid_reserve_profit =
    await determineProfitForInterimTokenAmount(
      token0.address,
      token1.address,
      mid_reserve.toFixed(),
      dex_to_buy,
      dex_to_sell
    )


  if (!mid_reserve_profit.success) {
    set_local_state_message("Mid range profit determination failed")
    return state;
  }

  if (mid_reserve_profit.profitable) {

    // if we reached this part
    // it means the mid range was profitable and we should save it 
    update_local_state(
      mid_reserve_profit.profit, 
      mid_reserve_profit.main_token_amount_required_to_buy, 
      mid_reserve_profit.interim_token_amount_to_verify, 
      mid_ratio,
      "Mid range is profitable"
    )

    // check higher ranges
    for (let i = 0; i < higher_ratios.length; i++) {

      const reserve =
        interim_token_reserves_on_dex_to_buy.times(higher_ratios[i]).round();
      const profit =
        await determineProfitForInterimTokenAmount(
          token0.address,
          token1.address,
          reserve.toFixed(),
          dex_to_buy,
          dex_to_sell
        );

      if (!profit.profitable) {
        // if the range is not profitable, we need to break and use previous one
        break;
      } else {
        // range is profitable
        update_local_state(
          profit.profit, 
          profit.main_token_amount_required_to_buy, 
          profit.interim_token_amount_to_verify, 
          higher_ratios[i],
          "High range is profitable"
        )
      }

    }

  } else {

    // check lower ranges
    for (let i = 0; i < lower_rations.length; i++) {

      const reserve =
        interim_token_reserves_on_dex_to_buy.times(lower_rations[i]).round();
      const profit =
        await determineProfitForInterimTokenAmount(
          token0.address,
          token1.address,
          reserve.toFixed(),
          dex_to_buy,
          dex_to_sell
        );

      if (profit.profitable) {
        // if the range is profitable, we break imediately 
        // because other ranges go lower
        update_local_state(
          profit.profit, 
          profit.main_token_amount_required_to_buy, 
          profit.interim_token_amount_to_verify, 
          lower_rations[i],
          "Lower range is profitable"
        )

        break;
      }
    }
  }

  return state;

}

const attemptArbitrage = async (
  account,
  contract,
  provider,
  router_address_to_buy,
  router_address_to_sell,
  main_token,
  interim_token,
  loan_amount
) => {

  console.log("Attempting Trade...")

  const account_balance_before_trade_in_wei =
    await account.getBalance()
  
  const fee_data = 
    await provider.getFeeData();

  const transaction =
    await contract
      .connect(account)
      .requestLoanAndExecuteTrade(
        router_address_to_buy,
        router_address_to_sell,
        main_token.address,
        interim_token.address,
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
  console.log(`   Transaction log => token balance BEFORE: ${ethers.utils.formatUnits(mainTokenBalanceBefore, main_token.decimals)}`)
  console.log(`   Transaction log => token balance AFTER: ${ethers.utils.formatUnits(mainTokenBalanceAfter, main_token.decimals)}`)

  // main token stats
  const contract_main_token_balance_before_trade =
    ethers.utils.formatUnits(
      mainTokenBalanceBefore,
      main_token.decimals
    );
  const contract_main_token_balance_after_trade =
    ethers.utils.formatUnits(
      mainTokenBalanceAfter,
      main_token.decimals
    );
  const contract_main_token_difference =
    Number(contract_main_token_balance_after_trade) - Number(contract_main_token_balance_before_trade)

  // native coin stats
  const account_balance_after_trade_in_wei =
    await account.getBalance()
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
    "Account Native Coin Balance Before": account_balance_before_trade,
    "Account Native Coin Balance After": account_balance_after_trade,
    "Transaction Cost": transaction_cost,
    "-": {},
    "Contract Main Token Balance Before": contract_main_token_balance_before_trade,
    "Contract Main Token Balance After": contract_main_token_balance_after_trade,
    "Contract Main Token Gained/Lost": contract_main_token_difference
  }
  console.table(log_data)
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

main().catch((error) => {
  console.log("\nMAIN LOOP ERROR...\n")
  console.log(error)
  logError(error);
});