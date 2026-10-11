// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBoostHubEthereumCurveRouter {
    function exchange_multiple(address[9] calldata route, uint256[3][4] calldata params, uint256 amount, uint256 minimum)
        external payable returns (uint256);
}
interface IBoostHubEthereumWstEth {
    function getStETHByWstETH(uint256 amount) external view returns (uint256);
    function unwrap(uint256 amount) external returns (uint256);
}
interface IBoostHubEthereumStablePool {
    function get_dy(int128 i, int128 j, uint256 amount) external view returns (uint256);
    function exchange(int128 i, int128 j, uint256 amount, uint256 minimum) external returns (uint256);
}
interface IBoostHubEthereumCryptoPool {
    function get_dy(uint256 i, uint256 j, uint256 amount) external view returns (uint256);
    function exchange(uint256 i, uint256 j, uint256 amount, uint256 minimum) external returns (uint256);
}

/// @notice Consolidates the four unique conversion pairs traced from Ethereum BoostHub
///         0xFbEF8941Da53EA724385B44E91ae9672061D0263 at block 26167322.
/// @dev Uses the deployed routes and their existing quote/minimum-output behavior.
///      CRV/sdCRV and wstETH/sdFXN use fee-adjusted pool oracles; the legacy stETH hop
///      and deployed YB converter use pool get_dy quotes. No converter fee is charged.
///      convert and four-argument swap preserve the caller-supplied minimum.
///      Three-argument swap calculates that minimum from the immutable slippageBps.
contract BoostHubEthereumRewardConverter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant CRV = 0xD533a949740bb3306d119CC777fa900bA034cd52;
    address public constant CRVUSD = 0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E;
    address public constant SDCRV = 0xD1b5651E55D4CeeD36251c61c50C889B36F6abB5;
    address public constant WSTETH = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    address public constant STETH = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    address public constant FXN = 0x365AccFCa291e7D3914637ABf1F7635dB165Bb09;
    address public constant SDFXN = 0xe19d1c837B8A1C83A56cD9165b2c0256D39653aD;
    address public constant YB = 0x01791F726B4103694969820be083196cC7c045fF;
    address public constant SDYB = 0x0c057598dcE1891688829581f890DD2a3685a43f;
    address public constant router = 0x99a58482BD75cbab83b27EC03CA68fF489b5788f;
    address public constant TRI_CRV_POOL = 0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14;
    address public constant CRV_SDCRV_POOL = 0xCA0253A98D16e9C1e3614caFDA19318EE69772D0;
    address public constant STETH_ETH_POOL = 0xDC24316b9AE028F1497c275EB9192a3Ea0f67022;
    address public constant ETH_FXN_POOL = 0xC15F285679a1Ef2d25F53D4CbD0265E1D02F2A92;
    address public constant FXN_SDFXN_POOL = 0x28Ca243dc0aC075dD012fCf9375C25D18A844d96;
    address public constant CRVUSD_YB_POOL = 0xec977F46467a3021785Cff88894886E617abd65b;
    address public constant YB_SDYB_POOL = 0x98b540fa89690969D111D045afCa575C91519B1A;
    address internal constant CURVE_NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    uint256 internal constant CURVE_FEE_DENOMINATOR = 1e10;
    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant MAX_SLIPPAGE_BPS = 400;
    uint256 public immutable slippageBps;

    error InvalidToken();
    error InvalidRoute();
    error InvalidSlippage();
    error ZeroAmount();
    error ZeroQuote();
    error Slippage();
    error OracleUnavailable();

    event Converted(address indexed caller, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    constructor(uint256 slippageBps_) {
        if (slippageBps_ > MAX_SLIPPAGE_BPS) revert InvalidSlippage();
        slippageBps = slippageBps_;
    }

    receive() external payable {}

    function routeCount() external pure returns (uint256) { return 4; }

    function routeAt(uint256 index) external pure returns (address tokenIn, address tokenOut) {
        if (index == 0) return (CRV, SDCRV);
        if (index == 1) return (CRVUSD, SDCRV);
        if (index == 2) return (WSTETH, SDFXN);
        if (index == 3) return (CRVUSD, SDYB);
        revert InvalidRoute();
    }

    function isSupportedPair(address tokenIn, address tokenOut) public pure returns (bool) {
        return (tokenIn == CRV && tokenOut == SDCRV) || (tokenIn == CRVUSD && tokenOut == SDCRV)
            || (tokenIn == WSTETH && tokenOut == SDFXN) || (tokenIn == CRVUSD && tokenOut == SDYB);
    }

    function route(address tokenIn, address tokenOut) external pure returns (address[9] memory route_) {
        (route_,) = _route(tokenIn, tokenOut);
    }

    function swapParams(address tokenIn, address tokenOut) external pure returns (uint256[3][4] memory params) {
        (,params) = _route(tokenIn, tokenOut);
    }

    function pools(address tokenIn, address tokenOut) external pure returns (address[] memory routePools) {
        (address[9] memory route_,) = _route(tokenIn, tokenOut);
        uint256 count;for (uint256 i = 1; i < 9 && route_[i] != address(0); i += 2) count++;
        routePools = new address[](count);for (uint256 i; i < count; i++) routePools[i] = route_[1 + i * 2];
    }

    function previewConvert(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256 amountOut) {
        if (!isSupportedPair(tokenIn, tokenOut)) revert InvalidToken();
        if (amountIn == 0) return 0;
        if (tokenOut == SDYB) {
            uint256 ybOut = IBoostHubEthereumCryptoPool(CRVUSD_YB_POOL).get_dy(0, 1, amountIn);
            if (ybOut == 0) return 0;
            return IBoostHubEthereumStablePool(YB_SDYB_POOL).get_dy(0, 1, ybOut);
        }
        (address[9] memory route_, uint256[3][4] memory params) = _route(tokenIn, tokenOut);
        uint256 firstHop;
        amountOut = amountIn;
        if (tokenIn == WSTETH) {
            uint256 stEthAmount = IBoostHubEthereumWstEth(WSTETH).getStETHByWstETH(amountIn);
            if (stEthAmount == 0) return 0;
            // Same exception as the deployed wstETH converter: this legacy pool has no price_oracle().
            amountOut = IBoostHubEthereumStablePool(STETH_ETH_POOL).get_dy(1, 0, stEthAmount);
            if (amountOut == 0) return 0;
            firstHop = 1;
        }
        for (uint256 hop = firstHop; hop < 4; hop++) {
            uint256 r = hop * 2;
            if (route_[r + 1] == address(0) || route_[r + 2] == address(0)) break;
            amountOut = _oracleSwapQuote(route_[r + 1], route_[r], route_[r + 2], params[hop][0], params[hop][1], amountOut);
        }
        if (tokenIn == CRVUSD && amountOut == 0) revert ZeroQuote();
    }

    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256) {
        return previewConvert(tokenIn, tokenOut, amountIn);
    }

    function convert(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        external nonReentrant returns (uint256) {
        return _convert(tokenIn, tokenOut, amountIn, minAmountOut);
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        external nonReentrant returns (uint256) {
        return _convert(tokenIn, tokenOut, amountIn, minAmountOut);
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn) external nonReentrant returns (uint256) {
        uint256 quoted = previewConvert(tokenIn, tokenOut, amountIn);
        if (quoted == 0) revert ZeroQuote();
        uint256 minimum = Math.mulDiv(quoted, FEE_DENOMINATOR - slippageBps, FEE_DENOMINATOR);
        return _convert(tokenIn, tokenOut, amountIn, minimum);
    }

    // Retains the deployed sdYB converter's Curve-router-shaped adapter interface.
    function get_exchange_multiple_amount(address[9] calldata route_, uint256[3][4] calldata, uint256 amount)
        external view returns (uint256) {
        _validateYbRoute(route_);
        return previewConvert(CRVUSD, SDYB, amount);
    }

    function exchange_multiple(address[9] calldata route_, uint256[3][4] calldata, uint256 amount, uint256 expected)
        external nonReentrant returns (uint256) {
        _validateYbRoute(route_);
        return _convert(CRVUSD, SDYB, amount, expected);
    }

    function _convert(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        internal returns (uint256 amountOut) {
        if (!isSupportedPair(tokenIn, tokenOut)) revert InvalidToken();
        if (amountIn == 0) revert ZeroAmount();
        if (tokenOut == SDYB) amountOut = _convertSdYb(amountIn, minAmountOut);
        else {
            (address[9] memory route_, uint256[3][4] memory params) = _route(tokenIn, tokenOut);
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
            uint256 routerAmount = amountIn;
            address routerToken = tokenIn;
            if (tokenIn == WSTETH) {
                uint256 beforeStEth = IERC20(STETH).balanceOf(address(this));
                IBoostHubEthereumWstEth(WSTETH).unwrap(amountIn);
                routerAmount = IERC20(STETH).balanceOf(address(this)) - beforeStEth;
                if (routerAmount == 0) revert ZeroQuote();
                routerToken = STETH;
            }
            IERC20(routerToken).forceApprove(router, routerAmount);
            uint256 beforeOut = IERC20(tokenOut).balanceOf(address(this));
            IBoostHubEthereumCurveRouter(router).exchange_multiple(route_, params, routerAmount, minAmountOut);
            IERC20(routerToken).forceApprove(router, 0);
            amountOut = IERC20(tokenOut).balanceOf(address(this)) - beforeOut;
            if (amountOut == 0) revert ZeroQuote();
            if (amountOut < minAmountOut) revert Slippage();
            IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        }
        emit Converted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    function _convertSdYb(uint256 amountIn, uint256 minAmountOut) internal returns (uint256 amountOut) {
        // Preserves the source bound to 0x10dF...4692: direct exchanges, final minimum and balance deltas.
        IERC20(CRVUSD).safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 beforeYb = IERC20(YB).balanceOf(address(this));
        IERC20(CRVUSD).forceApprove(CRVUSD_YB_POOL, amountIn);
        IBoostHubEthereumCryptoPool(CRVUSD_YB_POOL).exchange(0, 1, amountIn, 0);
        IERC20(CRVUSD).forceApprove(CRVUSD_YB_POOL, 0);
        uint256 ybOut = IERC20(YB).balanceOf(address(this)) - beforeYb;
        if (ybOut == 0) revert ZeroQuote();
        uint256 beforeOut = IERC20(SDYB).balanceOf(address(this));
        IERC20(YB).forceApprove(YB_SDYB_POOL, ybOut);
        IBoostHubEthereumStablePool(YB_SDYB_POOL).exchange(0, 1, ybOut, minAmountOut);
        IERC20(YB).forceApprove(YB_SDYB_POOL, 0);
        amountOut = IERC20(SDYB).balanceOf(address(this)) - beforeOut;
        if (amountOut == 0) revert ZeroQuote();
        if (amountOut < minAmountOut) revert Slippage();
        IERC20(SDYB).safeTransfer(msg.sender, amountOut);
    }

    function _route(address tokenIn, address tokenOut) internal pure
        returns (address[9] memory r, uint256[3][4] memory p) {
        if (tokenIn == CRV && tokenOut == SDCRV) {
            r[0] = CRV;r[1] = CRV_SDCRV_POOL;r[2] = SDCRV;p[0] = [uint256(0),1,1];
        } else if (tokenIn == CRVUSD && tokenOut == SDCRV) {
            r[0] = CRVUSD;r[1] = TRI_CRV_POOL;r[2] = CRV;r[3] = CRV_SDCRV_POOL;r[4] = SDCRV;
            p[0] = [uint256(0),2,3];p[1] = [uint256(0),1,1];
        } else if (tokenIn == WSTETH && tokenOut == SDFXN) {
            r[0] = STETH;r[1] = STETH_ETH_POOL;r[2] = CURVE_NATIVE;r[3] = ETH_FXN_POOL;
            r[4] = FXN;r[5] = FXN_SDFXN_POOL;r[6] = SDFXN;
            p[0] = [uint256(1),0,1];p[1] = [uint256(0),1,3];p[2] = [uint256(0),1,1];
        } else if (tokenIn == CRVUSD && tokenOut == SDYB) {
            r[0] = CRVUSD;r[1] = CRVUSD_YB_POOL;r[2] = YB;r[3] = YB_SDYB_POOL;r[4] = SDYB;
            p[0] = [uint256(0),1,3];p[1] = [uint256(0),1,1];
        } else revert InvalidToken();
    }

    function _validateYbRoute(address[9] calldata r) internal pure {
        if (r[0] != CRVUSD || r[1] != CRVUSD_YB_POOL || r[2] != YB || r[3] != YB_SDYB_POOL || r[4] != SDYB)
            revert InvalidRoute();
    }

    // Quote helpers preserved from the source bound to the current CRV and wstETH converters.
    function _oracleSwapQuote(address pool, address currentToken, address nextToken, uint256 i, uint256 j, uint256 amountIn)
        internal view returns (uint256 amountOut) {
        uint256 normalizedIn = _to18(amountIn, _tokenDecimals(currentToken));
        uint256 priceIn = i == 0 ? 1e18 : _poolOracle(pool, i);
        uint256 priceOut = j == 0 ? 1e18 : _poolOracle(pool, j);
        uint256 normalizedOut = Math.mulDiv(normalizedIn, priceIn, priceOut);
        uint256 fee = _poolFee(pool);
        if (fee >= CURVE_FEE_DENOMINATOR) revert OracleUnavailable();
        normalizedOut = Math.mulDiv(normalizedOut, CURVE_FEE_DENOMINATOR - fee, CURVE_FEE_DENOMINATOR);
        amountOut = _from18(normalizedOut, _tokenDecimals(nextToken));
    }

    function _poolFee(address pool) internal view returns (uint256 fee) {
        (bool ok, bytes memory data) = pool.staticcall(abi.encodeWithSignature("fee()"));
        if (!ok || data.length < 32) revert OracleUnavailable();
        fee = abi.decode(data, (uint256));
    }

    function _poolOracle(address pool, uint256 coinIndex) internal view returns (uint256 price) {
        if (coinIndex == 0) return 1e18;
        bool ok;bytes memory data;
        if (coinIndex == 1) {
            (ok, data) = pool.staticcall(abi.encodeWithSignature("price_oracle()"));
            if (ok && data.length >= 32) { price = abi.decode(data, (uint256));if (price != 0) return price; }
        }
        (ok, data) = pool.staticcall(abi.encodeWithSignature("price_oracle(uint256)", coinIndex - 1));
        if (!ok || data.length < 32) revert OracleUnavailable();
        price = abi.decode(data, (uint256));
        if (price == 0) revert OracleUnavailable();
    }

    function _tokenDecimals(address token) internal view returns (uint8) {
        if (token == CURVE_NATIVE) return 18;
        return IERC20Metadata(token).decimals();
    }

    function _to18(uint256 amount, uint8 decimals_) internal pure returns (uint256) {
        if (decimals_ == 18) return amount;
        if (decimals_ < 18) return amount * (10 ** (18 - decimals_));
        return amount / (10 ** (decimals_ - 18));
    }

    function _from18(uint256 amount, uint8 decimals_) internal pure returns (uint256) {
        if (decimals_ == 18) return amount;
        if (decimals_ < 18) return amount / (10 ** (18 - decimals_));
        return amount * (10 ** (decimals_ - 18));
    }
}
