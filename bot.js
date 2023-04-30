require('./helpers/globals')
require("dotenv").config();
require('./helpers/host-process')

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
  calculateMainTokenPriceDifferencePercentage_2,
  getDefaultArbitrageAmount,
  determineProfitForInterimTokenAmount,
  determine_trade_order
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

const {
  getDefaultArbitrageAmount_simulated,
  determineProfitForInterimTokenAmount_simulated
} = require("./helpers/arbitrage-simulation-service")

const _min_price_difference_percentage =
  config.Constraints.MinPriceDifferencePercentage;

const MIN_MAIN_TOKEN_PROFIT = 
  config.Constraints.MinMainTokenProfit.toString();

const DEFAULT_ARBITRAGE_AMOUNT = 
  config.Constraints.DefaultArbitrageAmount
    ? config.Constraints.DefaultArbitrageAmount.toString()
    : "1";

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

      try{
        await checkArbitrage(
          dex_1,
          dex_2,
          dex_1_pair_contract,
          dex_2_pair_contract,
          token0,
          token1,
          account,
          contract,
          provider
        )
      }catch(error){
        console.log("\nSWAP HANDLER ERROR...\n")
        console.log(error)
        logError(error)
      }

      console.log("\nWaiting for swap event...")

      isExecuting = false
      
    } 
  })

  dex_2_pair_contract.on('Swap', async (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
    if (!isExecuting) {

      isExecuting = true

      try{
        await checkArbitrage(
          dex_1,
          dex_2,
          dex_1_pair_contract,
          dex_2_pair_contract,
          token0,
          token1,
          account,
          contract,
          provider
        )
      }catch(error){
        console.log("\nSWAP HANDLER ERROR...\n")
        console.log(error)
        logError(error)
      }

      console.log("\nWaiting for swap event...")

      isExecuting = false

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
  contract,
  provider
) => {

  console.log("\n!!! NEW PRICE LOGIC !!!")
 
  const {
    main_token_dex_1_price,
    main_token_dex_2_price,
    delta
  } = await calculateMainTokenPriceDifferencePercentage_2(
    dex_1,
    dex_2,
    token0,
    token1
  );

  console.log(`Main token price difference ${delta} %`)

  if (Number(delta) < Number(_min_price_difference_percentage)) {

    console.log(`No Arbitrage (Delta Not Big Enough) Currently Available`)
    console.log(`-----------------------------------------\n`)

    return;
  }

  const {
    dex_to_buy,
    dex_to_sell
  } = determine_trade_order(
    dex_1,
    dex_2,
    main_token_dex_1_price,
    main_token_dex_2_price
  )

  console.log(`DEX to buy  => \t${dex_to_buy.Name}`)
  console.log(`DEX to sell => \t${dex_to_sell.Name}`)

  // const {
  //   estimated_profit_after_final_sale,
  //   main_token_amount_required_to_buy_interim_tokens,
  //   interim_token_arbitrage_amount,
  //   token_ratio_used,
  //   message
  // } = await determineDynamicProfit(
  //   dex_to_buy,
  //   dex_to_sell,
  //   dex_1,
  //   dex_2,
  //   dex_1_PairContract,
  //   dex_2_PairContract,
  //   token0,
  //   token1
  // )

  // console.log("\n\n\n\n\ndetermineDynamicProfit")
  // console.log(`   estimated_profit_after_final_sale => ${estimated_profit_after_final_sale} \t${ethers.utils.formatUnits(estimated_profit_after_final_sale.toString(), token0.decimals)}`)
  // console.log(`   main_token_amount_required_to_buy_interim_tokens => ${main_token_amount_required_to_buy_interim_tokens}`)
  // console.log(`   interim_token_arbitrage_amount => ${interim_token_arbitrage_amount}`)
  // console.log(`   token_ratio_used => ${token_ratio_used}`)
  // console.log(`   message => ${message}`)


  const {
    estimated_profit_after_final_sale,
    main_token_amount_required_to_buy_interim_tokens,
    interim_token_arbitrage_amount,
    token_ratio_used,
    message
  } = await determineDynamicProfit_2(
    dex_to_buy,
    dex_to_sell,
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
  console.log(`   Buy ${ethers.utils.formatUnits(interim_token_arbitrage_amount.toString(), token1.decimals)} ${token1.symbol}`)
  console.log(`   For ${ethers.utils.formatUnits(main_token_amount_required_to_buy_interim_tokens.toString(), token0.decimals)} ${token0.symbol}`)
  console.log(`   Profit after selling ${token1.symbol} is ${ethers.utils.formatUnits(estimated_profit_after_final_sale.toString(), token0.decimals)} ${token0.symbol}`)
  console.log(`   Last profitable ratio: ${token_ratio_used}`)
  console.log(`   Message: ${message}\n`)

  // no profit
  if (big(estimated_profit_after_final_sale).lt(0)) {

    const entry = {
      type: "arbitrage",
      data_1: "no arbitrage (no profit)",
      data_2: estimated_profit_after_final_sale
    }
    logInfo(entry)

    console.log(`No Arbitrage (No Profit) Currently Available\n`)
    console.log(`-----------------------------------------\n`)

    return;
  }

  // not enough profit
  if (big(estimated_profit_after_final_sale).lt(ethers.utils.parseUnits(MIN_MAIN_TOKEN_PROFIT, token0.decimals))) {

    const entry = {
      type: "arbitrage",
      data_1: "no arbitrage (not enough profit)",
      data_2: estimated_profit_after_final_sale
    }
    logInfo(entry)

    console.log(`No Arbitrage (Not Enough Profit) Currently Available`)
    console.log(`Min Profit is at least ${MIN_MAIN_TOKEN_PROFIT} ${token0.symbol}\n`)
    console.log(`-----------------------------------------\n`)

    return;
  }

  // Profitable trade
  if (config.Constraints.ExecuteTrades) {

    const entry = {
      type: "arbitrage",
      data_1: "executing trades is enabled"
    }
    logInfo(entry)

    await attemptArbitrage(
      account,
      contract,
      provider,
      dex_to_buy.Router.address,
      dex_to_sell.Router.address,
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// const determineDynamicProfit = async (
//   dex_to_buy,
//   dex_to_sell,
//   dex_1,
//   dex_2,
//   dex_1_PairContract,
//   dex_2_PairContract,
//   token0,
//   token1
// ) => {

//   // local state
//   const state = {
//     estimated_profit_after_final_sale: -1,
//     main_token_amount_required_to_buy_interim_tokens: -1,
//     interim_token_arbitrage_amount: -1,
//     token_ratio_used: -1,
//     message: ""
//   };

//   const update_local_state = (
//     profit, 
//     main_token_amount, 
//     interim_token_amount, 
//     ratio,
//     message
//   ) => {
//     state.estimated_profit_after_final_sale = profit;
//     state.main_token_amount_required_to_buy_interim_tokens = main_token_amount;
//     state.interim_token_arbitrage_amount = interim_token_amount;
//     state.token_ratio_used = ratio;
//     state.message = message;
//   }

//   const log_profit_data_from_contract = profit_data => log_profit_data(profit_data, "From contract")

//   const log_profit_data_from_simulation = profit_data => log_profit_data(profit_data, "From simulation")

//   const log_profit_data = (
//     profit_data,
//     message
//   ) => {
//     console.log(message)
//     console.log(`   main_token_amount_required_to_buy => ${ethers.utils.formatEther(profit_data.main_token_amount_required_to_buy)} \t ${profit_data.main_token_amount_required_to_buy}`)
//     console.log(`   main_token_amount_received_after_sale => ${ethers.utils.formatEther(profit_data.main_token_amount_received_after_sale)} \t ${profit_data.main_token_amount_received_after_sale}`)
//     console.log(`   profit => ${profit_data.profit}`)
//     console.log(`   interim_token_amount_to_verify => ${ethers.utils.formatEther(profit_data.interim_token_amount_to_verify)} \t ${profit_data.interim_token_amount_to_verify}`)
//   }

//   const set_local_state_message = 
//     (message) => 
//       state.message = message;

//   let token1_reserves_on_dex_to_buy = null;
//   let token1_reserves_on_dex_to_sell = null;
//   let token0_reserves_on_dex_to_buy = null;
//   let token0_reserves_on_dex_to_sell = null;
//   let token1_amount_for_arbitrage = null;

//   // Get interim token reserves on both DEXes
//   if (dex_to_buy.Name == dex_1.Name) {

//     // DEX 1 is the dex to buy 
//     const reserves_on_dex_to_buy =
//       await getReserves(dex_1_PairContract)
//     const reserves_on_dex_to_sell =
//       await getReserves(dex_2_PairContract)

//     // interim token reserves
//     token1_reserves_on_dex_to_buy =
//       reserves_on_dex_to_buy[token1.index_Inside_Dex1_Pair]
//     token1_reserves_on_dex_to_sell =
//       reserves_on_dex_to_sell[token1.index_Inside_Dex2_Pair]

//     // main token reserves
//     token0_reserves_on_dex_to_buy =
//       reserves_on_dex_to_buy[token0.index_Inside_Dex1_Pair]
//     token0_reserves_on_dex_to_sell =
//       reserves_on_dex_to_sell[token0.index_Inside_Dex2_Pair]

//   } else if (dex_to_buy.Name == dex_2.Name) {

//     // DEX 2 is the dex to buy 
//     const reserves_on_dex_to_buy =
//       await getReserves(dex_2_PairContract)
//     const reserves_on_dex_to_sell =
//       await getReserves(dex_1_PairContract)

//     // interim token reserves
//     token1_reserves_on_dex_to_buy =
//       reserves_on_dex_to_buy[token1.index_Inside_Dex2_Pair]
//     token1_reserves_on_dex_to_sell =
//       reserves_on_dex_to_sell[token1.index_Inside_Dex1_Pair]

//     // main token reserves
//     token0_reserves_on_dex_to_buy =
//       reserves_on_dex_to_buy[token0.index_Inside_Dex2_Pair]
//     token0_reserves_on_dex_to_sell =
//       reserves_on_dex_to_sell[token0.index_Inside_Dex1_Pair]

//   } else {
//     // weird shit
//     throw "cannot determine DEXes to get token reserves";
//   }


//   // simalation stuff mapping
//   const interim_token_reserves_on_dex_to_buy_for_simulation = 
//     token1_reserves_on_dex_to_buy;

//   const interim_token_reserves_on_dex_to_sell_for_simulation = 
//     token1_reserves_on_dex_to_sell;

//   const main_token_reserves_on_dex_to_buy_for_simulation = 
//     token0_reserves_on_dex_to_buy;

//   const main_token_reserves_on_dex_to_sell_for_simulation = 
//     token0_reserves_on_dex_to_sell;

//   console.log(`\nInterim token reserves on DEX TO BUY => \t${ethers.utils.formatUnits(token1_reserves_on_dex_to_buy, token1.decimals)}`)
//   console.log(`Interim token reserves on DEX TO SELL => \t${ethers.utils.formatUnits(token1_reserves_on_dex_to_sell, token1.decimals) }`)
//   await sleep(50);

//   // check default amount first
//   const default_interim_token_amount =
//     await getDefaultArbitrageAmount(
//       dex_to_buy,
//       token0,
//       token1,
//       DEFAULT_ARBITRAGE_AMOUNT
//     )

//   const default_interim_token_amount_from_simulation = 
//     getDefaultArbitrageAmount_simulated(
//       DEFAULT_ARBITRAGE_AMOUNT,
//       token0,
//       main_token_reserves_on_dex_to_buy_for_simulation,
//       interim_token_reserves_on_dex_to_buy_for_simulation
//     )

//   console.log(`\nDefault interim amount`)
//   console.log(`From contract => \t${default_interim_token_amount}`)
//   console.log(`From simulation => \t${default_interim_token_amount_from_simulation}`)
  
//   await sleep(50);

//   console.log("TRACE determineDynamicProfit 1")

//   // something failed
//   if (!default_interim_token_amount) {
//     set_local_state_message("Default arbitrage amount determination failed")
//     return state;
//   }

//   console.log("TRACE determineDynamicProfit 2")

//   const default_amount_profit =
//     await determineProfitForInterimTokenAmount(
//       token0.address,
//       token1.address,
//       default_interim_token_amount,
//       dex_to_buy,
//       dex_to_sell
//     )
//   const default_amount_profit_simulated =
//     determineProfitForInterimTokenAmount_simulated(
//       default_interim_token_amount_from_simulation,
//       interim_token_reserves_on_dex_to_buy_for_simulation,
//       interim_token_reserves_on_dex_to_sell_for_simulation,
//       main_token_reserves_on_dex_to_buy_for_simulation,
//       main_token_reserves_on_dex_to_sell_for_simulation
//     )

//   console.log(`\nDefault amount profit`)
//   log_profit_data_from_contract(default_amount_profit)
//   log_profit_data_from_simulation(default_amount_profit_simulated)

//   await sleep(50);

//   console.log("TRACE determineDynamicProfit 3")
  

//   // something failed during default amount check
//   if (!default_amount_profit.success) {
//     set_local_state_message("Default arbitrage amount profit determination failed")
//     return state;
//   }
  
//   console.log("TRACE determineDynamicProfit 4")

//   // if the default amount is not profitable, it's not worth continuing
//   if (!default_amount_profit.profitable) {
//     update_local_state(
//       default_amount_profit.profit, 
//       default_amount_profit.main_token_amount_required_to_buy, 
//       default_amount_profit.interim_token_amount_to_verify, 
//       -1,
//       "Default arbitrage amount not profitable"
//     )
//     return state;
//   }

//   console.log("TRACE determineDynamicProfit 5")

//   // if we reached this part
//   // it means at least the default amount was profitable 
//   // and we should save it
//   update_local_state(
//     default_amount_profit.profit, 
//     default_amount_profit.main_token_amount_required_to_buy, 
//     default_amount_profit.interim_token_amount_to_verify, 
//     0,
//     "Default arbitrage amount is profitable"
//   )

//   console.log("TRACE determineDynamicProfit 6")

//   // from here 
//   //    => 
//   //        check other amounts to find the most profit

//   const mid_ratio = 0.5;
//   const higher_ratios = [0.6, 0.7, 0.8, 0.9]
//   const lower_rations = [0.4, 0.3, 0.2, 0.1, 0.05, 0.025, 0.01]
//   const interim_token_reserves_on_dex_to_buy = big(token1_reserves_on_dex_to_buy)

//   const mid_reserve =
//     interim_token_reserves_on_dex_to_buy.times(mid_ratio).round();

//   const mid_reserve_profit =
//     await determineProfitForInterimTokenAmount(
//       token0.address,
//       token1.address,
//       mid_reserve.toFixed(),
//       dex_to_buy,
//       dex_to_sell
//     )

//   const mid_reserve_profit_simulated =
//     await determineProfitForInterimTokenAmount_simulated(
//       mid_reserve.toFixed(),
//       interim_token_reserves_on_dex_to_buy_for_simulation,
//       interim_token_reserves_on_dex_to_sell_for_simulation,
//       main_token_reserves_on_dex_to_buy_for_simulation,
//       main_token_reserves_on_dex_to_sell_for_simulation
//    )

//    console.log(`\nMid range profit`)
//    log_profit_data_from_contract(mid_reserve_profit)
//    log_profit_data_from_simulation(mid_reserve_profit_simulated)

//   await sleep(50);

//   console.log("TRACE determineDynamicProfit 7")

//   if (!mid_reserve_profit.success) {
//     set_local_state_message("Mid range profit determination failed")
//     return state;
//   }

//   if (mid_reserve_profit.profitable) {

//     console.log("TRACE determineDynamicProfit 8")

//     // if we reached this part
//     // it means the mid range was profitable and we should save it 
//     update_local_state(
//       mid_reserve_profit.profit, 
//       mid_reserve_profit.main_token_amount_required_to_buy, 
//       mid_reserve_profit.interim_token_amount_to_verify, 
//       mid_ratio,
//       "Mid range is profitable"
//     )

//     // check higher ranges
//     for (let i = 0; i < higher_ratios.length; i++) {


//       const reserve =
//         interim_token_reserves_on_dex_to_buy.times(higher_ratios[i]).round();
//       const profit =
//         await determineProfitForInterimTokenAmount(
//           token0.address,
//           token1.address,
//           reserve.toFixed(),
//           dex_to_buy,
//           dex_to_sell
//         );

//       const profit_simulated =
//         await determineProfitForInterimTokenAmount_simulated(
//           reserve.toFixed(),
//           interim_token_reserves_on_dex_to_buy_for_simulation,
//           interim_token_reserves_on_dex_to_sell_for_simulation,
//           main_token_reserves_on_dex_to_buy_for_simulation,
//           main_token_reserves_on_dex_to_sell_for_simulation
//         );

//       console.log(`\nHigh range ${higher_ratios[i]} profit`)
//       log_profit_data_from_contract(profit)
//       log_profit_data_from_simulation(profit_simulated)
            
//       await sleep(50);

//       if (!profit.profitable) {
//         // if the range is not profitable, we need to break and use previous one
//         break;
//       } else {
//         // range is profitable
//         update_local_state(
//           profit.profit, 
//           profit.main_token_amount_required_to_buy, 
//           profit.interim_token_amount_to_verify, 
//           higher_ratios[i],
//           "High range is profitable"
//         )
//       }

//     }

//   } else {

//     console.log("TRACE determineDynamicProfit 9")

//     // check lower ranges
//     for (let i = 0; i < lower_rations.length; i++) {

//       const reserve =
//         interim_token_reserves_on_dex_to_buy.times(lower_rations[i]).round();
//       const profit =
//         await determineProfitForInterimTokenAmount(
//           token0.address,
//           token1.address,
//           reserve.toFixed(),
//           dex_to_buy,
//           dex_to_sell
//         );

//       const profit_simulated =
//         await determineProfitForInterimTokenAmount_simulated(
//           reserve.toFixed(),
//           interim_token_reserves_on_dex_to_buy_for_simulation,
//           interim_token_reserves_on_dex_to_sell_for_simulation,
//           main_token_reserves_on_dex_to_buy_for_simulation,
//           main_token_reserves_on_dex_to_sell_for_simulation
//         );

//       console.log(`\nLow range ${lower_rations[i]} profit`)

//       log_profit_data_from_contract(profit)
//       log_profit_data_from_simulation(profit_simulated)

//       await sleep(50);

//       if (profit.profitable) {
//         // if the range is profitable, we break imediately 
//         // because other ranges go lower
//         update_local_state(
//           profit.profit, 
//           profit.main_token_amount_required_to_buy, 
//           profit.interim_token_amount_to_verify, 
//           lower_rations[i],
//           "Lower range is profitable"
//         )

//         break;
//       }
//     }
//   }

//   return state;

// }

const determineDynamicProfit_2 = async (
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
  let token0_reserves_on_dex_to_buy = null;
  let token0_reserves_on_dex_to_sell = null;
  let token1_amount_for_arbitrage = null;

  // Get interim token reserves on both DEXes
  if (dex_to_buy.Name == dex_1.Name) {

    // DEX 1 is the dex to buy 
    const reserves_on_dex_to_buy =
      await getReserves(dex_1_PairContract)
    const reserves_on_dex_to_sell =
      await getReserves(dex_2_PairContract)

    // interim token reserves
    token1_reserves_on_dex_to_buy =
      reserves_on_dex_to_buy[token1.index_Inside_Dex1_Pair]
    token1_reserves_on_dex_to_sell =
      reserves_on_dex_to_sell[token1.index_Inside_Dex2_Pair]

    // main token reserves
    token0_reserves_on_dex_to_buy =
      reserves_on_dex_to_buy[token0.index_Inside_Dex1_Pair]
    token0_reserves_on_dex_to_sell =
      reserves_on_dex_to_sell[token0.index_Inside_Dex2_Pair]

  } else if (dex_to_buy.Name == dex_2.Name) {

    // DEX 2 is the dex to buy 
    const reserves_on_dex_to_buy =
      await getReserves(dex_2_PairContract)
    const reserves_on_dex_to_sell =
      await getReserves(dex_1_PairContract)

    // interim token reserves
    token1_reserves_on_dex_to_buy =
      reserves_on_dex_to_buy[token1.index_Inside_Dex2_Pair]
    token1_reserves_on_dex_to_sell =
      reserves_on_dex_to_sell[token1.index_Inside_Dex1_Pair]

    // main token reserves
    token0_reserves_on_dex_to_buy =
      reserves_on_dex_to_buy[token0.index_Inside_Dex2_Pair]
    token0_reserves_on_dex_to_sell =
      reserves_on_dex_to_sell[token0.index_Inside_Dex1_Pair]

  } else {
    // weird shit
    throw "cannot determine DEXes to get token reserves";
  }

  // simalation stuff mapping
  const interim_token_reserves_on_dex_to_buy_for_simulation = 
    token1_reserves_on_dex_to_buy;
  const interim_token_reserves_on_dex_to_sell_for_simulation = 
    token1_reserves_on_dex_to_sell;
  const main_token_reserves_on_dex_to_buy_for_simulation = 
    token0_reserves_on_dex_to_buy;
  const main_token_reserves_on_dex_to_sell_for_simulation = 
    token0_reserves_on_dex_to_sell;

  console.log(`\nInterim token reserves on DEX TO BUY => \t${ethers.utils.formatUnits(token1_reserves_on_dex_to_buy, token1.decimals)}`)
  console.log(`Interim token reserves on DEX TO SELL => \t${ethers.utils.formatUnits(token1_reserves_on_dex_to_sell, token1.decimals) }`)

  const default_interim_token_amount_from_simulation = 
    getDefaultArbitrageAmount_simulated(
      DEFAULT_ARBITRAGE_AMOUNT,
      token0,
      main_token_reserves_on_dex_to_buy_for_simulation,
      interim_token_reserves_on_dex_to_buy_for_simulation
    )

  // something failed
  if (!default_interim_token_amount_from_simulation) {
    set_local_state_message("Default arbitrage amount simulation failed")
    return state;
  }

  const default_amount_profit_simulated =
    determineProfitForInterimTokenAmount_simulated(
      default_interim_token_amount_from_simulation,
      interim_token_reserves_on_dex_to_buy_for_simulation,
      interim_token_reserves_on_dex_to_sell_for_simulation,
      main_token_reserves_on_dex_to_buy_for_simulation,
      main_token_reserves_on_dex_to_sell_for_simulation
    ) 

  // something failed during default amount check
  if (!default_amount_profit_simulated.success) {
    set_local_state_message("Default arbitrage amount profit simulation failed")
    return state;
  }

  // if the default amount is not profitable, it's not worth continuing
  if (!default_amount_profit_simulated.profitable) {
    update_local_state(
      default_amount_profit_simulated.profit, 
      default_amount_profit_simulated.main_token_amount_required_to_buy, 
      default_amount_profit_simulated.interim_token_amount_to_verify, 
      -1,
      "Default arbitrage amount not profitable"
    )
    return state;
  }

  // if we reached this part
  // it means at least the default amount was profitable 
  // and we should save it
  update_local_state(
    default_amount_profit_simulated.profit, 
    default_amount_profit_simulated.main_token_amount_required_to_buy, 
    default_amount_profit_simulated.interim_token_amount_to_verify, 
    0,
    "Default arbitrage amount is profitable"
  )

  // various ranges we test for higst profit
  const interim_token_ratios = [
    0.001,
    0.0025,
    0.005,
    0.0075,
    0.01,
    0.025,
    0.05,
    0.075,
    0.1,
    0.15,
    0.2,
    0.25,
    0.3,
    0.35,
    0.4,
    0.45,
    0.5,
    0.7,
    0.9
  ];

  for (let i = 0; i < interim_token_ratios.length; i++) {

    const ratio = interim_token_ratios[i];
    const interim_token_reserve_part =
      big(interim_token_reserves_on_dex_to_buy_for_simulation).times(ratio).round();

    const simulated_profit =
      await determineProfitForInterimTokenAmount_simulated(
        interim_token_reserve_part.toFixed(),
        interim_token_reserves_on_dex_to_buy_for_simulation,
        interim_token_reserves_on_dex_to_sell_for_simulation,
        main_token_reserves_on_dex_to_buy_for_simulation,
        main_token_reserves_on_dex_to_sell_for_simulation
      );

    // udpate state if there's profit and if it's bigger than the current one
    if ((simulated_profit.profitable)
      &&
      (big(simulated_profit.profit).gt(state.estimated_profit_after_final_sale))) {

        update_local_state(
          simulated_profit.profit,
          simulated_profit.main_token_amount_required_to_buy,
          simulated_profit.interim_token_amount_to_verify,
          ratio,
          `Ratio ${ratio} is profitable`
        )

    } 

  }

  // If simulations showed any profit
  // check if it's actually proftitable on the chain
  if (state.estimated_profit_after_final_sale > 0) {
    const on_chain_profit =
      await determineProfitForInterimTokenAmount(
        token0.address,
        token1.address,
        state.interim_token_arbitrage_amount,
        dex_to_buy,
        dex_to_sell
      );

    update_local_state(
      on_chain_profit.profit,
      on_chain_profit.main_token_amount_required_to_buy,
      on_chain_profit.interim_token_amount_to_verify,
      state.token_ratio_used,
      `${state.message} + profit calculated by contract`
    )
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

  await sleep(50);

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
    constraints_min_main_token_profit: config.Constraints.MinMainTokenProfit,
    constraints_default_arbitrage_amount: config.Constraints.DefaultArbitrageAmount
  })
}

main().catch((error) => {
  console.log("\nMAIN LOOP ERROR...\n")
  console.log(error)
  logError(error);
});