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

    receive() external payable { }

    fallback() external payable { }

    function requestLoanAndExecuteTrade(
        address dexToBuyRouterAddress,
        address dexToSellRouterAddress,
        address mainTokenAddress,
        address interimTokenAddress,
        uint256 loanAmount
    ) external {

        // encode input data for later use in the callback
        uint256 mainTokenBalanceBeforeTrade = IERC20(mainTokenAddress).balanceOf(address(this));

        bytes memory userData = abi.encode(
            dexToBuyRouterAddress,
            dexToSellRouterAddress,
            mainTokenAddress,
            interimTokenAddress,
            mainTokenBalanceBeforeTrade
        );

        // move stuff into arrays to match the balancer interface
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = IERC20(mainTokenAddress);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = loanAmount;

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

        IERC20 mainTokenBorrowed = tokens[0];
        uint256 amountBorrowed = amounts[0];      

        // check if we actually got the loan
        uint256 mainTokenBalanceAfterLoan = mainTokenBorrowed.balanceOf(address(this));

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

        // sell path param => opposite of buy, buy main tokens for interim tokens
        address[] memory sellPath = new address[](2);
        sellPath[0] = interimTokenAddress;
        sellPath[1] = mainTokenAddress;

        uint256 interimTokenAmountAvailableToSell = IERC20(interimTokenAddress).balanceOf(address(this));

        // allow the sell router to use our interim tokens 
        require(
            IERC20(sellPath[0]).approve(dexToSellRouterAddress, interimTokenAmountAvailableToSell),
            "Dex to sell approval failed."
        );

        routerToSell.swapExactTokensForTokens(
            interimTokenAmountAvailableToSell,
            amountBorrowed,
            sellPath,
            address(this),
            (block.timestamp + 1200)
        );
 
        // return the loan 
        mainTokenBorrowed.transfer(_vault, amountBorrowed);

        // check if we made any profit
        uint256 finalMainTokenBalance = mainTokenBorrowed.balanceOf(address(this));

        require(
            finalMainTokenBalance > mainTokenBalanceBeforeTrade,
            "Trade was not profitable."
        );
    }

    function getBalance() public view returns (uint) 
    {
        return address(this).balance;
    }

    function getTokenBalance(address tokenAddress) public view returns (uint) 
    {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    function withdraw() public onlyOwner 
    {
        uint amount = address(this).balance;

        (bool success, ) = _owner.call{value: amount}("");
        require(success, "Failed to send Ether");
    }

    function withdrawToken(address tokenAddress) public onlyOwner 
    {
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
