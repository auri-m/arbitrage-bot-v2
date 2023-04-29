const big =
    require('big.js')


// !!!!!!!!!!!!!!  original Solidity function !!!!!!!!!!!

// function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
//
//     require(amountIn > 0, 'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
//     require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
//
//     uint amountInWithFee = amountIn.mul(997);
//     uint numerator = amountInWithFee.mul(reserveOut);
//     uint denominator = reserveIn.mul(1000).add(amountInWithFee);
//
//     amountOut = numerator / denominator;
// }

const getAmountOut = (amountIn, reserveIn, reserveOut) => {

    const amount_in = big(amountIn);
    const reserve_in = big(reserveIn);
    const reserve_out = big(reserveOut);

    if(amount_in.lte(0))
        throw 'Fake UniswapV2Library Service: INSUFFICIENT_INPUT_AMOUNT'
    
    if(reserve_in.lte(0))
        throw 'Fake UniswapV2Library Service: INSUFFICIENT_LIQUIDITY'

    if(reserve_out.lte(0))
        throw 'Fake UniswapV2Library Service: INSUFFICIENT_LIQUIDITY'

    const amount_in_with_fee = amount_in.times(997);
    const numerator = amount_in_with_fee.times(reserve_out);
    const denominator = reserve_in.times(1000).plus(amount_in_with_fee);
    const amount_out = numerator.div(denominator);

    return amount_out;
}


// !!!!!!!!!!!!!!  original Solidity function !!!!!!!!!!!

// function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal pure returns (uint amountIn) {
// 
//     require(amountOut > 0, 'UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT');
//     require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
// 
//     uint numerator = reserveIn.mul(amountOut).mul(1000);
//     uint denominator = reserveOut.sub(amountOut).mul(997);
// 
//     amountIn = (numerator / denominator).add(1);
// }

const getAmountIn = (amountOut, reserveIn, reserveOut) => {

    const amount_out = big(amountOut);
    const reserve_in = big(reserveIn);
    const reserve_out = big(reserveOut);

    if(amount_out.lte(0))
        throw 'Fake UniswapV2Library Service: INSUFFICIENT_INPUT_AMOUNT'

    if(reserve_in.lte(0))
        throw 'Fake UniswapV2Library Service: INSUFFICIENT_LIQUIDITY'

    if(reserve_out.lte(0))
        throw 'Fake UniswapV2Library Service: INSUFFICIENT_LIQUIDITY'

    const numerator = reserve_in.times(amount_out).times(1000);
    const denominator_1 = reserve_out.minus(amount_out);
    const denominator = denominator_1.times(997);
    const amount_in = numerator.div(denominator).plus(1);

    return amount_in;
}

module.exports = {
    getAmountOut,
    getAmountIn
}