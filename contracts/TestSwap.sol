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

contract TestSwap is IFlashLoanRecipient {
    
    address payable private _owner;
    address public immutable _vault;
    string private _version = "";

    event ProfitableTransactionOccurred(
        uint256 mainTokenBalanceBefore, 
        uint256 mainTokenBalanceAfter
    );

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

    function doTest(
        address dexToBuyRouterAddress,
        address dexToSellRouterAddress,
        address mainTokenAddress,
        address interimTokenAddress,
        uint256 loanAmount
    ) external
    {
        //  stats before transaction
        uint256 mainTokenBalanceBeforeTransaction = 
            IERC20(mainTokenAddress).balanceOf(address(this));

        // encode input data for later use in the callback
        bytes memory userData = abi.encode(
            dexToBuyRouterAddress,
            dexToSellRouterAddress,
            interimTokenAddress
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

        // stats after transaction
        uint256 mainTokenBalanceAfterTransaction = 
            IERC20(mainTokenAddress).balanceOf(address(this));
        
        // capture the before/after state of 
        emit ProfitableTransactionOccurred(
            mainTokenBalanceBeforeTransaction, 
            mainTokenBalanceAfterTransaction
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
            address interimTokenAddress
        ) = abi.decode(userData, (address, address, address));

        // helper structures
        IERC20 mainToken = tokens[0];
        address mainTokenAddress = address(tokens[0]);
        uint256 amountBorrowed = amounts[0];    
        IERC20 interimToken = IERC20(interimTokenAddress);

        console.log("main token address", mainTokenAddress);
        console.log("interim token address", interimTokenAddress);
        console.log("amount borrowed", amountBorrowed);

        require(
            amountBorrowed > 0,
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
            mainToken.approve(dexToBuyRouterAddress, amountBorrowed),
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

        console.log("interim token bought");

        // sell path param => opposite of buy, buy main tokens for interim tokens
        address[] memory sellPath = new address[](2);
        sellPath[0] = interimTokenAddress;
        sellPath[1] = mainTokenAddress;

        uint256 interimTokenAmountAvailableToSell = interimToken.balanceOf(address(this));

        // allow the sell router to use our interim tokens 
        require(
            interimToken.approve(dexToSellRouterAddress, interimTokenAmountAvailableToSell),
            "Dex to sell approval failed."
        );

        routerToSell.swapExactTokensForTokens(
            interimTokenAmountAvailableToSell,
            0,
            sellPath,
            address(this),
            (block.timestamp + 1200)
        );

        console.log("interim token sold");

        console.log("main token balance after swap", mainToken.balanceOf(address(this)));
 
        // return the loan 
        mainToken.transfer(_vault, amountBorrowed);
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
