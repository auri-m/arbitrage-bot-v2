require('./helpers/globals')
require("dotenv").config();
require('./helpers/host-process')

const _config = require('./config.json')
const _ethers = require("ethers")
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
  calculatePrice, 
  estimateMainTokenProfit,
  pickArbitrageAmount
} = require('./helpers/token-service')

const {
  logError,
  logInfo
} = require('./helpers/log-service');


const _min_price_difference_percentage = _config.Constraints.MinPriceDifferencePercentage;

let isExecuting = false

const main = async () => {

  logCurrentConfig()

  const provider = getProvider();
  const dex_1 = getDex1(provider);
  const dex_2 = getDex2(provider);

  const token0 = await getMainToken(provider);
  const token1 = await getInterimToken(provider);

  const dex_1_PairContract = await getPairContract(dex_1.Factory, token0.address, token1.address, provider)
  const dex_2_PairContract = await getPairContract(dex_2.Factory, token0.address, token1.address, provider)

  // determine the token positions inside dex pairs
  const dex_1_pair_token0 = await dex_1_PairContract.token0();
  const dex_1_pair_token1 = await dex_1_PairContract.token1();
  const dex_2_pair_token0 = await dex_2_PairContract.token0();
  const dex_2_pair_token1 = await dex_2_PairContract.token1();

  token0.index_Inside_Dex1_Pair = getTokenPositionInsidePair(token0.address, dex_1_pair_token0, dex_1_pair_token1);
  token0.index_Inside_Dex2_Pair = getTokenPositionInsidePair(token0.address, dex_2_pair_token0, dex_2_pair_token1);

  token1.index_Inside_Dex1_Pair = getTokenPositionInsidePair(token1.address, dex_1_pair_token0, dex_1_pair_token1);
  token1.index_Inside_Dex2_Pair = getTokenPositionInsidePair(token1.address, dex_2_pair_token0, dex_2_pair_token1);

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
    dex_1_pair_address: dex_1_PairContract.address,
    dex_2_name: dex_2.Name,
    dex_2_pair_address: dex_2_PairContract.address,
  }
  logInfo(dex_runtime_data)
  console.table(dex_runtime_data)

  dex_1_PairContract.on('Swap', async (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
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
        dex_1_PairContract, 
        dex_2_PairContract, 
        token0, 
        token1,
        provider
      )

      isExecuting = false
    }
  })

  dex_2_PairContract.on('Swap', async (sender, amount0In, amount1In, amount0Out, amount1Out, to) => {
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
        dex_1_PairContract, 
        dex_2_PairContract, 
        token0, 
        token1,
        provider
      )
      
      isExecuting = false
    }
  })


  const initialization_complete = {
    type: "initialization-complete"
  }
  logInfo(initialization_complete)
  console.log("Waiting for swap event...")
}

const checkArbitrage = async(
  dex_1, 
  dex_2, 
  dex_1_PairContract, 
  dex_2_PairContract, 
  token0, 
  token1,
  provider
) => {

  const priceDifferencePercentage = await checkPrice(
    dex_1.Name, 
    dex_2.Name, 
    dex_1_PairContract, 
    dex_2_PairContract, 
    token0, 
    token1
  )

  const routerPath = await determineTradePath(
    priceDifferencePercentage, 
    dex_1, 
    dex_2
  )

  if (!routerPath) {

    const entry = {
      type: "arbitrage",
      data_1: "no arbitrage (no trade path)",
      data_2: priceDifferencePercentage
    }
    logInfo(entry)

    console.log(`No Arbitrage (No Trade Path) Currently Available\n`)
    console.log(`-----------------------------------------\n`)
    isExecuting = false
    return
  }

  const estimated_gas_cost = getEstimatedGasCost();

  const {
    command_executed_successfully,
    estimated_profit,
    main_token_amount_required_to_buy
  } = await determineProfit(
    routerPath, 
    dex_1, 
    dex_2, 
    dex_1_PairContract, 
    dex_2_PairContract,  
    token0, 
    token1,
    provider,
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

  if(_config.Constraints.ExecuteTrades){

    const entry = {
      type: "arbitrage",
      data_1: "executing trades is enabled"
    }
    logInfo(entry)

    console.log("Executing trades is enabled")

    const receipt = await executeTrade(routerPath, token0.contract, token1.contract)
    
  } else {

    const entry = {
      type: "arbitrage",
      data_1: "executing trades is disabled"
    }
    logInfo(entry)

    console.log("Executing trades is disabled")
  }

}

const checkPrice = async (
  dex1Name, 
  dex2Name, 
  dex1PairContract, 
  dex2PairContract, 
  token0, 
  token1
) => {
  // on chain price with decimals
  const dex1OnChainPrice = await calculatePrice(dex1PairContract)
  const dex2OnChainPrice = await calculatePrice(dex2PairContract)

  // rounded price
  const dex1Price = Number(dex1OnChainPrice).toFixed(0)
  const dex2Price = Number(dex2OnChainPrice).toFixed(0)

  // price difference as a percentage
  const priceDifferencePercentage = (((dex1Price - dex2Price) / dex2Price) * 100).toFixed(2)

  const entry = {
    type: "arbitrage",
    data_1: "check price result",
    dex_1_name: dex1Name,
    dex_1_price: dex1Price,
    dex_2_name: dex2Name,
    dex_2_price: dex2Price,

  }
  logInfo(entry)

  console.log(`${dex1Name} \t| ${token1.symbol}/${token0.symbol}\t | ${dex1Price}`)
  console.log(`${dex2Name} \t| ${token1.symbol}/${token0.symbol}\t | ${dex2Price}\n`)

  return priceDifferencePercentage
}

const determineTradePath = async (
  currentPriceDifferencePercentage, 
  dex_1, 
  dex_2
) => {
  console.log(`Determining Direction...\n`)
  
  // result
  // 0 - router of the exchange to buy
  // 1 - router of the exchnage to sell

  if (currentPriceDifferencePercentage >= _min_price_difference_percentage) {

    const entry = {
      type: "arbitrage",
      data_1: "potential arbitrage direction 1",
      buy: dex_1.Name,
      sell: dex_2.Name
    }
    logInfo(entry)

    console.log(`Potential Arbitrage Direction:\n`)
    console.log(`Buy\t -->\t ${dex_1.Name}`)
    console.log(`Sell\t -->\t ${dex_2.Name}\n`)

    return [dex_1.Router, dex_2.Router]

  } else if (currentPriceDifferencePercentage <= -(_min_price_difference_percentage)) {

    const entry = {
      type: "arbitrage",
      data_1: "potential arbitrage direction 2",
      buy: dex_2.Name,
      sell: dex_1.Name
    }
    logInfo(entry)

    console.log(`Potential Arbitrage Direction:\n`)
    console.log(`Buy\t -->\t ${dex_2.Name}`)
    console.log(`Sell\t -->\t ${dex_1.Name}\n`)
    return [dex_2.Router, dex_1.Router]

  } else {
    return null
  }
}

const determineProfit = async (
  routerPath, 
  dex_1, 
  dex_2, 
  dex_1_PairContract, 
  dex_2_PairContract,  
  token0, 
  token1,
  provider,
  estimated_gas_cost
) => {

  console.log(`Determining Profitability...\n`)

  let dex_to_buy = null
  let dex_to_sell = null
  let token1_reserves_on_dex_to_buy = null;
  let token1_reserves_on_dex_to_sell = null;
  let token1_amount_for_arbitrage = null;

  if (routerPath[0].address == dex_1.Router.address) {

    dex_to_buy = dex_1;
    dex_to_sell = dex_2;

    const reserves_on_dex_to_buy = await getReserves(dex_1_PairContract)
    const reserves_on_dex_to_sell = await getReserves(dex_2_PairContract)

    token1_reserves_on_dex_to_buy = reserves_on_dex_to_buy[token1.index_Inside_Dex1_Pair]
    token1_reserves_on_dex_to_sell = reserves_on_dex_to_sell[token1.index_Inside_Dex2_Pair]

    // reserves = await getReserves(dex_2_PairContract)
    // reservesOnDexToSell.token0 = reserves[token0.index_Inside_Dex2_Pair]
    // reservesOnDexToSell.token1 = reserves[token1.index_Inside_Dex2_Pair]
    // exchangeToBuy = dex_1.Name
    // exchangeToSell = dex_2.Name
  } else {

    dex_to_buy = dex_2;
    dex_to_sell = dex_1;

    const reserves_on_dex_to_buy = await getReserves(dex_2_PairContract)
    const reserves_on_dex_to_sell = await getReserves(dex_1_PairContract)

    token1_reserves_on_dex_to_buy = reserves_on_dex_to_buy[token1.index_Inside_Dex2_Pair]
    token1_reserves_on_dex_to_sell = reserves_on_dex_to_sell[token1.index_Inside_Dex1_Pair]

    // reserves = await getReserves(dex_1_PairContract)
    // reservesOnDexToSell.token0 = reserves[token0.index_Inside_Dex1_Pair]
    // reservesOnDexToSell.token1 = reserves[token1.index_Inside_Dex1_Pair]
    // exchangeToBuy = dex_2.Name
    // exchangeToSell = dex_1.Name
  }

  // amount available for arbitrage is the lowest reserve
  token1_amount_for_arbitrage = pickArbitrageAmount(
    token1_reserves_on_dex_to_buy, 
    token1_reserves_on_dex_to_sell
  )

  const profitability_data_1 = {
    type: "arbitrage",
    data_1: "profitability data 1",
    dex_to_buy: dex_to_buy.Name,
    interim_token_amount_on_dex_to_buy: _ethers.utils.formatUnits(token1_reserves_on_dex_to_buy, 'ether'),
    dex_to_sell: dex_to_sell.Name,
    interim_token_amount_on_dex_to_sell: _ethers.utils.formatUnits(token1_reserves_on_dex_to_sell, 'ether'),
    interim_token_amount_for_arbitrage: _ethers.utils.formatUnits(token1_amount_for_arbitrage, 'ether'),
  }
  logInfo(profitability_data_1)

  // const log_token_data = {
  //   'DEX To Buy': dex_to_buy.Name,
  //   'Interim Token Amount On Dex To Buy': _ethers.utils.formatUnits(token1_reserves_on_dex_to_buy, 'ether'),
  //   '-': {},
  //   'DEX To Sell': dex_to_sell.Name,
  //   'Interim Token Amount On Dex To Sell': _ethers.utils.formatUnits(token1_reserves_on_dex_to_sell, 'ether'),
  //   '-': {},
  //   'Interim Token Amount For Arbitrage': _ethers.utils.formatUnits(token1_amount_for_arbitrage, 'ether')
  // }

  console.table(profitability_data_1)
  console.log()

  try {

    // getAmountsIn(amountOut, [TOKEN_0, TOKEN_1])
    // given the "amountOut" value of TOKEN_1, this function will tell us how many TOKEN_0 we need
    // shows how many TOKEN_0 we need in order to get the "amountOut" of TOKEN_1

    // dex's kuriame pirksim
    // paduodam amount'a kuri norim gauti (amountOut)
    // pirmas elementas -> tokenas kuri norim moket/ikelt (token0 == main token == WETH)
    // antras elementas -> tokenas kuri norim gaut (token1 == interim token == SHIB)

    const amountsOnDexToBuy = await routerPath[0].getAmountsIn(
      token1_amount_for_arbitrage, 
      [token0.address, token1.address]
    )
    const token0_amount_required_to_buy_token1_on_dex_to_buy = amountsOnDexToBuy[0];
    const token1_amount_available_on_dex_to_buy = amountsOnDexToBuy[1];

    // getAmountsOut(amountIn, [TOKEN_0, TOKEN_1])
    // given the "amountIn" value of TOKEN_0, this function will tell us how many TOKEN_1 we receive
    // shows how many TOKEN_1 we get from "amountIn" of TOKEN_0

    // dex's kuriame parduosim
    // paduodam amount'a kuri turim (amountIn)
    // pirmas elementas -> tokenas kuri norim moket (token1 == interim token == SHIB)
    // antras elementas -> tokenas kuri norim gaut (token0 == main token == WETH)

    const amountsOnDexToSell = await routerPath[1].getAmountsOut(
      token1_amount_available_on_dex_to_buy, 
      [token1.address, token0.address]
    )
    const token1_amount_available_to_sell_on_dex_to_sell = amountsOnDexToSell[0]
    const token0_amount_received_on_dex_to_sell = amountsOnDexToSell[1]

    const profitability_data_2 = {
      type: "arbitrage",
      data_1: "profitability data 2",
      interim_token_available_to_buy: token1_amount_available_on_dex_to_buy,
      main_token_amount_needed: _ethers.utils.formatUnits(token0_amount_required_to_buy_token1_on_dex_to_buy.toString(), 'ether'),
      main_token_estimated_return: _ethers.utils.formatUnits(token0_amount_received_on_dex_to_sell.toString(), 'ether')
    }
    logInfo(profitability_data_2)

    console.log(`Estimated amount of ${token0.symbol} needed to buy ${token1_amount_available_on_dex_to_buy} ${token1.symbol} on ${dex_to_buy.Name}\t\t|${_ethers.utils.formatUnits(token0_amount_required_to_buy_token1_on_dex_to_buy.toString(), 'ether')}`)
    console.log(`Estimated amount of ${token0.symbol} returned after swapping ${token1_amount_available_on_dex_to_buy} ${token1.symbol} on ${dex_to_sell.Name}\t|${_ethers.utils.formatUnits(token0_amount_received_on_dex_to_sell.toString(), 'ether')}\n`)

    const estimated_profit = await estimateMainTokenProfit(
      token0_amount_required_to_buy_token1_on_dex_to_buy, 
      routerPath, 
      token0, 
      token1
    )

    // account
    const account = new _ethers.Wallet(process.env.PRIVATE_KEY, provider)

    // estimated transaction costs
    const native_coin_balance_before_transaction = _ethers.utils.formatUnits(await account.getBalance(), 'ether')
    const native_coin_balance_after_transaction = native_coin_balance_before_transaction - estimated_gas_cost

    // estimated main token profits
    const token0_wallet_balance_before = Number(_ethers.utils.formatUnits(await token0.contract.balanceOf(account.address), 'ether'))
    const token0_wallet_balance_after = estimated_profit + token0_wallet_balance_before
    const token0_wallet_balance_difference = token0_wallet_balance_after - token0_wallet_balance_before

    const profitability_data_3 = {
      type: "arbitrage",
      data_1: "profitability data 3",
      native_coin_balance_before: native_coin_balance_before_transaction,
      native_coin_balance_after: native_coin_balance_after_transaction,
      transaction_cost: estimated_gas_cost,
      main_token_balance_before: token0_wallet_balance_before,
      main_token_balance_after: token0_wallet_balance_after,
      main_token_gained_lost: token0_wallet_balance_difference
    }
    logInfo(profitability_data_3)

    const log_data = {
      'Native Coin Balance Before': native_coin_balance_before_transaction,
      'Native Coin Balance After': native_coin_balance_after_transaction,
      'Transaction Cost': estimated_gas_cost,
      '-': {},
      'Main Token Balance Before': token0_wallet_balance_before,
      'Main Token Balance After': token0_wallet_balance_after,
      'Main Token Gained/Lost': token0_wallet_balance_difference
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
    console.log(`\nError occured while trying to determine profitability...\n`)
    console.log(`This can typically happen because of liquidity issues, see README for more information.\n`)

    return {
      command_executed_successfully: false,
      estimated_profit : 0,
      main_token_amount_required_to_buy: 0
    }
  }
}

const executeTrade = async (_routerPath, _token0Contract, _token1Contract) => {
  // console.log(`Attempting Arbitrage...\n`)

  // let startOnUniswap

  // if (_routerPath[0]._address == dex_1.Router._address) {
  //   startOnUniswap = true
  // } else {
  //   startOnUniswap = false
  // }

  // // Create Signer
  // const account = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  // // Fetch token balances before
  // const tokenBalanceBefore = await _token0Contract.balanceOf(account.address)
  // const ethBalanceBefore = await account.getBalance()

  // if (config.PROJECT_SETTINGS.isDeployed) {
  //   const transaction = await arbitrage.connect(account).executeTrade(startOnUniswap, _token0Contract.address, _token1Contract.address, amount)
  //   const receipt = await transaction.wait()
  // }

  // console.log(`Trade Complete:\n`)

  // // Fetch token balances after
  // const tokenBalanceAfter = await _token0Contract.balanceOf(account.address)
  // const ethBalanceAfter = await account.getBalance()

  // const tokenBalanceDifference = tokenBalanceAfter - tokenBalanceBefore
  // const ethBalanceDifference = ethBalanceBefore - ethBalanceAfter

  // const data = {
  //   'ETH Balance Before': ethers.utils.formatUnits(ethBalanceBefore, 'ether'),
  //   'ETH Balance After': ethers.utils.formatUnits(ethBalanceAfter, 'ether'),
  //   'ETH Spent (gas)': ethers.utils.formatUnits(ethBalanceDifference.toString(), 'ether'),
  //   '-': {},
  //   'WETH Balance BEFORE': ethers.utils.formatUnits(tokenBalanceBefore, 'ether'),
  //   'WETH Balance AFTER': ethers.utils.formatUnits(tokenBalanceAfter, 'ether'),
  //   'WETH Gained/Lost': ethers.utils.formatUnits(tokenBalanceDifference.toString(), 'ether'),
  //   '-': {},
  //   'Total Gained/Lost': `${ethers.utils.formatUnits((tokenBalanceDifference - ethBalanceDifference).toString(), 'ether')} ETH`
  // }

  // console.table(data)
}

const getTokenPositionInsidePair = (targetToken, pairToken0, pairToken1) => {
  if(targetToken === pairToken0) {
    return 0
  } else if (targetToken === pairToken1){
    return 1
  } else {
    throw `cannot determine token ${targetToken} possition`;   
  }
}

const getEstimatedGasCost = () => {
  const ignoreGas = _config.Constraints.IgnoreGas;
  if(ignoreGas)
    return 0

  const gasLimit = _config.Constraints.GasLimit; 
  const gasPrice = _config.Constraints.GasPrice;

  return gasLimit * gasPrice
}

const logCurrentConfig = () => {
  logInfo({
    type: "static-config",
    port: _config.Port,
    chain: _config.Chain,
    main_token_name: _config.MainToken.Name,
    main_token_address: _config.MainToken.Address,
    interim_token_name: _config.InterimToken.Name,
    interim_token_address: _config.InterimToken.Address,
    dex_1_name: _config.Dex_1.Name,
    dex_1_router: _config.Dex_1.RouterAddress,
    dex_1_factory: _config.Dex_1.FactoryAddress,
    dex_2_name: _config.Dex_2.Name,
    dex_2_router: _config.Dex_2.RouterAddress,
    dex_2_factory: _config.Dex_2.FactoryAddress,
    constraints_execute_trades: _config.Constraints.ExecuteTrades,
    constraints_min_price_difference_percentage: _config.Constraints.MinPriceDifferencePercentage,
    constraints_ignore_gas: _config.Constraints.IgnoreGas,
    constraints_gas_limit: _config.Constraints.GasLimit,
    constraints_gas_price: _config.Constraints.GasPrice
  })
}

main().catch((error) => {
  console.log("Main error caught")
  console.log(error)
  logError(error);
});