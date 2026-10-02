// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";

interface IERC20S {
    function approve(address, uint256) external returns (bool);
}

interface ICurveV1Crypto {
    function coins(uint256) external view returns (address);
    function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy, bool useEth) external payable returns (uint256);
}

interface ITricryptoNG {
    function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy, bool useEth, address receiver)
        external
        payable
        returns (uint256);
}

/// CRV -> ETH swap gas and output: tricrv (crvUSD/WETH/CRV) vs the classic CRV/ETH crypto pool.
contract SwapCompareTest is Test {
    address constant CRV = 0xD533a949740bb3306d119CC777fa900bA034cd52;
    address constant TRICRV = 0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14;
    address constant CRVETH = 0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511;

    receive() external payable {}

    function setUp() public {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"));
    }

    function _run(uint256 amount) internal {
        deal(CRV, address(this), amount * 2);
        IERC20S(CRV).approve(TRICRV, type(uint256).max);
        IERC20S(CRV).approve(CRVETH, type(uint256).max);
        console2.log("coins CRV/ETH pool:", ICurveV1Crypto(CRVETH).coins(0), ICurveV1Crypto(CRVETH).coins(1));

        uint256 snap = vm.snapshotState();
        uint256 g = gasleft();
        uint256 outA = ITricryptoNG(TRICRV).exchange(2, 1, amount, 0, true, address(this));
        uint256 gasA = g - gasleft();
        vm.revertToState(snap);
        g = gasleft();
        uint256 outB = ICurveV1Crypto(CRVETH).exchange(1, 0, amount, 0, true);
        uint256 gasB = g - gasleft();

        console2.log("CRV in (wei)", amount);
        console2.log("tricrv  gas / ETH out", gasA, outA);
        console2.log("CRV/ETH gas / ETH out", gasB, outB);
    }

    function test_swap_50crv() public {
        _run(50 ether);
    }

    function test_swap_500crv() public {
        _run(500 ether);
    }
}
