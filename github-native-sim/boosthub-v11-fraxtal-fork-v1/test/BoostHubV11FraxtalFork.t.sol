// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BoostHubFraxtalRewardConverter} from "../src/BoostHubFraxtalRewardConverter_v1.sol";

interface IFraxtalCurveV11 {
    function coins(uint256 i) external view returns (address);
}

contract BoostHubV11FraxtalForkTest is Test {
    address constant FXS = 0xFc00000000000000000000000000000000000002;
    address constant SDFXS = 0x1AEe2382e05Dc68BDfC472F1E46d570feCca5814;
    address constant POOL = 0x3df1658e3E76d14eF3C4d410829EA7575bB83B9B;
    BoostHubFraxtalRewardConverter internal converter;

    function setUp() public {
        vm.createSelectFork(vm.envString("FRAXTAL_FORK_RPC"));
        assertEq(block.chainid, 252, "FORK_MUST_BE_FRAXTAL");
        assertGt(POOL.code.length, 0, "POOL_MUST_EXIST");
        emit log_named_address("curve_coin0", IFraxtalCurveV11(POOL).coins(0));
        emit log_named_address("curve_coin1", IFraxtalCurveV11(POOL).coins(1));
        assertEq(IFraxtalCurveV11(POOL).coins(0), FXS, "WRONG_COIN0");
        assertEq(IFraxtalCurveV11(POOL).coins(1), SDFXS, "WRONG_COIN1");
        converter = new BoostHubFraxtalRewardConverter(100, address(this));
    }

    function test_DeploymentOwnerAndSingleRoute() public {
        assertEq(converter.owner(), address(this));
        assertEq(converter.slippageBps(), 100);
        assertEq(converter.routeCount(), 1);
        (address tokenIn, address tokenOut) = converter.routeAt(0);
        assertEq(tokenIn, FXS);
        assertEq(tokenOut, SDFXS);
        assertTrue(converter.isSupportedPair(FXS, SDFXS));
        assertFalse(converter.isSupportedPair(SDFXS, FXS));
        uint256 ema = converter.poolOracle();
        assertGt(ema, 0, "POOL_EMA_ORACLE_REQUIRED");
        uint256 expected = converter.getAmountOut(FXS, SDFXS, 1e18);
        emit log_named_uint("ema_price", ema);
        emit log_named_uint("quoted_sdfxs_per_fxs_1e18", expected);
        assertGt(expected, 0);
    }

    function test_ActualSwapAndOracleMinOut() public {
        deal(FXS, address(this), 1e18);
        IERC20(FXS).approve(address(converter), 1e18);
        uint256 beforeWant = IERC20(SDFXS).balanceOf(address(this));
        uint256 quote = converter.getAmountOut(FXS, SDFXS, 1e18);
        uint256 received = converter.swap(FXS, SDFXS, 1e18);
        uint256 afterWant = IERC20(SDFXS).balanceOf(address(this));
        assertEq(afterWant - beforeWant, received);
        assertGe(received, quote * 9900 / 10000, "EMA_SLIPPAGE_MINOUT");
        emit log_named_uint("actual_swap_received", received);
    }

    function test_UnsupportedRouteMustRevert() public {
        vm.expectRevert(BoostHubFraxtalRewardConverter.UnsupportedPair.selector);
        converter.getAmountOut(SDFXS, FXS, 1e18);
    }

    function test_SlippageMustStayWithinCap() public {
        vm.expectRevert(BoostHubFraxtalRewardConverter.InvalidSlippage.selector);
        converter.setSlippageBps(401);
    }
}
