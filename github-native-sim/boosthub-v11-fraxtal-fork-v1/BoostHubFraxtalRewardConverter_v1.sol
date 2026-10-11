// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBoostHubFraxtalCurvePool {
    function coins(uint256 index) external view returns (address);
    function exchange(int128 i, int128 j, uint256 dx, uint256 minDy) external returns (uint256);
}

/**
 * @notice Fraxtal BoostHub PID-0 FXS -> sdFXS reward converter.
 * @dev Single installed pair, single known Curve pool. Existing sdFXS rewards
 *      are already the underlying and must NOT pass through this converter.
 *      Execution slippage is measured exclusively against this same pool's
 *      EMA price_oracle, never the manipulable same-block get_dy spot quote.
 *      Constructor takes explicit owner for CREATE3 deployment proxies.
 *      If the pool does not expose an EMA oracle, conversion fails closed.
 */
contract BoostHubFraxtalRewardConverter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant FXS = 0xFc00000000000000000000000000000000000002;
    address public constant SDFXS = 0x1AEe2382e05Dc68BDfC472F1E46d570feCca5814;
    address public constant CURVE_POOL = 0x3df1658e3E76d14eF3C4d410829EA7575bB83B9B;
    uint256 public constant MAX_SLIPPAGE_BPS = 400;
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public slippageBps;

    error UnsupportedPair();
    error InvalidPoolCoins();
    error OracleUnavailable();
    error InvalidOracle();
    error InvalidSlippage();
    error ZeroAmount();
    error OutputBelowMinimum(uint256 received, uint256 required);

    event Converted(address indexed caller, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event SetSlippageBps(uint256 slippageBps);

    constructor(uint256 initialSlippageBps, address initialOwner) Ownable(initialOwner) {
        if (IBoostHubFraxtalCurvePool(CURVE_POOL).coins(0) != FXS ||
            IBoostHubFraxtalCurvePool(CURVE_POOL).coins(1) != SDFXS) revert InvalidPoolCoins();
        _setSlippageBps(initialSlippageBps);
        _poolOracle();
    }

    function setSlippageBps(uint256 value) external onlyOwner { _setSlippageBps(value); }

    function _setSlippageBps(uint256 value) internal {
        if (value > MAX_SLIPPAGE_BPS) revert InvalidSlippage();
        slippageBps = value;
        emit SetSlippageBps(value);
    }

    function routeCount() external pure returns (uint256) { return 1; }
    function routeAt(uint256 index) external pure returns (address tokenIn, address tokenOut) {
        if (index != 0) revert UnsupportedPair();
        return (FXS, SDFXS);
    }
    function isSupportedPair(address tokenIn, address tokenOut) public pure returns (bool) {
        return tokenIn == FXS && tokenOut == SDFXS;
    }
    function pools(address tokenIn, address tokenOut) external pure returns (address[] memory result) {
        _checkPair(tokenIn, tokenOut);
        result = new address[](1);
        result[0] = CURVE_POOL;
    }

    function _checkPair(address tokenIn, address tokenOut) internal pure {
        if (!isSupportedPair(tokenIn, tokenOut)) revert UnsupportedPair();
    }

    function _poolOracle() internal view returns (uint256 price) {
        (bool ok, bytes memory result) = CURVE_POOL.staticcall(abi.encodeWithSignature("price_oracle()"));
        if (!ok || result.length != 32) {
            (ok, result) = CURVE_POOL.staticcall(abi.encodeWithSignature("price_oracle(uint256)", uint256(0)));
        }
        if (!ok || result.length != 32) revert OracleUnavailable();
        price = abi.decode(result, (uint256));
        if (price == 0) revert InvalidOracle();
    }

    function poolOracle() external view returns (uint256) { return _poolOracle(); }

    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256) {
        _checkPair(tokenIn, tokenOut);
        if (amountIn == 0) return 0;
        return Math.mulDiv(amountIn, 1e18, _poolOracle());
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn) external nonReentrant returns (uint256) {
        return _swap(tokenIn, tokenOut, amountIn, 0);
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut) external nonReentrant returns (uint256) {
        return _swap(tokenIn, tokenOut, amountIn, minOut);
    }

    function convert(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut) external nonReentrant returns (uint256) {
        return _swap(tokenIn, tokenOut, amountIn, minOut);
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 callerMinimum) internal returns (uint256 received) {
        _checkPair(tokenIn, tokenOut);
        if (amountIn == 0) revert ZeroAmount();
        uint256 oracleMinimum = Math.mulDiv(getAmountOut(tokenIn, tokenOut, amountIn), FEE_DENOMINATOR - slippageBps, FEE_DENOMINATOR);
        uint256 minimum = callerMinimum > oracleMinimum ? callerMinimum : oracleMinimum;
        if (minimum == 0) revert InvalidOracle();
        IERC20(FXS).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(FXS).forceApprove(CURVE_POOL, amountIn);
        uint256 beforeOut = IERC20(SDFXS).balanceOf(address(this));
        IBoostHubFraxtalCurvePool(CURVE_POOL).exchange(0, 1, amountIn, minimum);
        IERC20(FXS).forceApprove(CURVE_POOL, 0);
        received = IERC20(SDFXS).balanceOf(address(this)) - beforeOut;
        if (received < minimum) revert OutputBelowMinimum(received, minimum);
        IERC20(SDFXS).safeTransfer(msg.sender, received);
        emit Converted(msg.sender, tokenIn, tokenOut, amountIn, received);
    }
}
