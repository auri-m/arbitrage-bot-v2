// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.18;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

interface IFlashLoanRecipient {
    function receiveFlashLoan(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external;
}

interface IBalancerVault {
    function flashLoan(
        IFlashLoanRecipient recipient,
        IERC20[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
}

contract BalancerV2 is IFlashLoanRecipient {
    
    address payable private _owner;
    address public immutable _vault;
    string private _version = "";

    modifier onlyOwner() 
    {
        require(
            msg.sender == _owner, 
            "caller is not the owner!"
        );
        _;
    }

    constructor(
        address vault, 
        string memory version
    ) payable  {
        _owner = payable(msg.sender);
        _vault = vault;
        _version = version;
    }

    receive() external payable { console.log("receive called"); }

    fallback() external payable { console.log("fallback called"); }

    function requestLoanAndExecuteTrade(
        address dexToBuyRouterAddress,
        address dexToSellRouterAddress,
        address mainTokenAddress,
        address interimTokenAddress,
        uint256 loanAmount
    ) external {

        console.log("inside requestLoanAndExecuteTrade");
        console.log("dexToBuyRouterAddress =>", dexToBuyRouterAddress);
        console.log("dexToSellRouterAddress =>", dexToSellRouterAddress);
        console.log("mainTokenAddress =>", mainTokenAddress);
        console.log("interimTokenAddress =>", interimTokenAddress);
        console.log("loanAmount =>", loanAmount);

        console.log("0");

        // encode input data for later use in the callback
        IERC20 aac = IERC20(mainTokenAddress);

        console.log("0_1");

        console.log(address(this));
        console.log(address(aac));

        console.log("0_2");
        //            0x1f720e7952650ed8ca142febd52acbe8b7a21741
        address aaa = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

        // 0x1f720e7952650ed8ca142febd52acbe8b7a21741
        //console.log(aac.symbol());
        //console.log(aac.name());
        console.log(aac.balanceOf(aaa));

        console.log("0_3");

        uint256 mainTokenBalanceBeforeTrade = IERC20(mainTokenAddress).balanceOf(address(this));

        console.log("1");

        bytes memory userData = abi.encode(
            dexToBuyRouterAddress,
            dexToSellRouterAddress,
            mainTokenAddress,
            interimTokenAddress,
            mainTokenBalanceBeforeTrade
        );

        console.log("2");

        // move stuff into arrays to match the balancer interface
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = IERC20(mainTokenAddress);

        console.log("3");

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = loanAmount;

        console.log("4");

        // call flashloan provider
        IBalancerVault(_vault).flashLoan(
            IFlashLoanRecipient(address(this)),
            tokens,
            amounts,
            userData
        );
    }

    function receiveFlashLoan(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory,
        bytes memory userData
    ) external override 
    {   
        console.log("flashloan received");

        // make sure the flashloan provider called this
        require(
            msg.sender == _vault,
            "caller is not the vault!"
        );
        
        // decode input
        (
            address dexToBuyRouterAddress,
            address dexToSellRouterAddress,
            address mainTokenAddress,
            address interimTokenAddress,
            uint256 mainTokenBalanceBeforeTrade
        ) = abi.decode(userData, (address, address, address, address, uint256));

        console.log("main token balance before loan:", mainTokenBalanceBeforeTrade);

        IERC20 mainTokenBorrowed = tokens[0];
        uint256 amountBorrowed = amounts[0];      

        console.log("token borrowed:", address(mainTokenBorrowed));
        console.log("borrowed amount:", amountBorrowed);


        // check if we actually got the loan
        uint256 mainTokenBalanceAfterLoan = mainTokenBorrowed.balanceOf(address(this));

        console.log("main token balance after loan:", mainTokenBalanceAfterLoan);

        require(
            amountBorrowed + mainTokenBalanceBeforeTrade == mainTokenBalanceAfterLoan,
            "contract did not get the loan!"
        );

        // !!! main swap logic !!!
        IUniswapV2Router02 routerToBuy = IUniswapV2Router02(dexToBuyRouterAddress);
        IUniswapV2Router02 routerToSell = IUniswapV2Router02(dexToSellRouterAddress);
        
        // buy path param => buy interim tokens for main tokens
        address[] memory buyPath = new address[](2);
        buyPath[0] = mainTokenAddress;
        buyPath[1] = interimTokenAddress;

        // allow the buy router to use our main tokens 
        require(
            IERC20(buyPath[0]).approve(dexToBuyRouterAddress, amountBorrowed),
            "Dex to buy approval failed."
        );

        // execute swap
        routerToBuy.swapExactTokensForTokens(
            amountBorrowed,
            0,
            buyPath,
            address(this),
            (block.timestamp + 1200)
        );

        console.log("buy executed successfully");

        // sell path param => opposite of buy, buy main tokens for interim tokens
        address[] memory sellPath = new address[](2);
        sellPath[0] = interimTokenAddress;
        sellPath[1] = mainTokenAddress;

        uint256 interimTokenAmountAvailableToSell = IERC20(interimTokenAddress).balanceOf(address(this));

        console.log("main token balance after buy:", IERC20(mainTokenAddress).balanceOf(address(this)));
        console.log("interim token balance after buy:", interimTokenAmountAvailableToSell);

        // allow the sell router to use our interim tokens 
        require(
            IERC20(sellPath[0]).approve(dexToSellRouterAddress, interimTokenAmountAvailableToSell),
            "Dex to sell approval failed."
        );

        routerToSell.swapExactTokensForTokens(
            interimTokenAmountAvailableToSell,
            0,
            sellPath,
            address(this),
            (block.timestamp + 1200)
        );

        console.log("sell executed successfully");

        console.log("main token after sell:", IERC20(mainTokenAddress).balanceOf(address(this)));
        console.log("interim token after sell:", IERC20(interimTokenAddress).balanceOf(address(this)));        

        // return the loan 
        mainTokenBorrowed.transfer(_vault, amountBorrowed);

        console.log("loan returned");

        // check if we made any profit
        uint256 finalMainTokenBalance = mainTokenBorrowed.balanceOf(address(this));

        console.log("final main token balance:", finalMainTokenBalance);

        require(
            finalMainTokenBalance > mainTokenBalanceBeforeTrade,
            "Trade was not profitable."
        );
    }

    function getBalance() public view returns (uint) 
    {
        console.log("getBalance called");

        return address(this).balance;
    }

    function getTokenBalance(address tokenAddress) public view returns (uint) 
    {
        console.log("getTokenBalance called");

        return IERC20(tokenAddress).balanceOf(address(this));
    }

    function withdraw() public onlyOwner 
    {
        console.log("withdraw called");

        uint amount = address(this).balance;

        (bool success, ) = _owner.call{value: amount}("");
        require(success, "Failed to send Ether");
    }

    function withdrawToken(address tokenAddress) public onlyOwner 
    {
        console.log("withdrawToken called");

        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
        IERC20(tokenAddress).transfer(_owner, balance);
    }

    function getOwner() external view returns (address) 
    {
        return _owner;
    }

    function getVersion() external view returns (string memory) 
    {
        return _version;
    }
}
