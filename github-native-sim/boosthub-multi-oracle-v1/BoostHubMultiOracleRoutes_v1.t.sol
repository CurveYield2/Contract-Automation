// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {BoostHubDexTwapRoutes} from "../contracts/converter/BoostHubDexTwapRoutes_v1.sol";
import {BoostHubEthereumRewardConverter} from "../contracts/converter/BoostHubEthereumRewardConverter_v8.sol";
import {BoostHubFraxtalRewardConverter} from "../contracts/converter/BoostHubFraxtalRewardConverter_v2.sol";

contract BHMockToken is ERC20 {
    constructor(string memory name_) ERC20(name_,name_) {}
    function mint(address to,uint256 amt) external {_mint(to,amt);}
}
contract BHMockV2Pair {
    address public token0; address public token1; address public factory;
    uint32 public timestamp;
    constructor(address a,address b,address f) {token0=a;token1=b;factory=f;timestamp=uint32(block.timestamp);}
    function getReserves() external view returns(uint112,uint112,uint32){return (100 ether,100 ether,timestamp);}
    function price0CumulativeLast() external pure returns(uint256){return 0;}
    function price1CumulativeLast() external pure returns(uint256){return 0;}
}
contract BHMockV2Router {
    address public factory;
    constructor(address f){factory=f;}
    function swapExactTokensForTokens(uint256 amountIn,uint256,address[] calldata path,address to,uint256)
        external returns(uint256[] memory amounts) {
        IERC20(path[0]).transferFrom(msg.sender,address(this),amountIn);
        BHMockToken(path[1]).mint(to,amountIn);
        amounts=new uint256[](2);amounts[0]=amountIn;amounts[1]=amountIn;
    }
}
contract BHMockV3Pool {
    address public token0; address public token1; address public factory;uint24 public fee;
    int24 public meanTick;
    constructor(address a,address b,address f,uint24 e){token0=a;token1=b;factory=f;fee=e;}
    function setMeanTick(int24 tick) external {meanTick=tick;}
    function observe(uint32[] calldata secondsAgos) external view returns(int56[] memory cumulatives,uint160[] memory liq){
        cumulatives=new int56[](secondsAgos.length);liq=new uint160[](secondsAgos.length);
        for (uint256 i;i<secondsAgos.length;i++) cumulatives[i]=int56(meanTick)*int56(uint56(block.timestamp-secondsAgos[i]));
    }
}
contract BHMockV3Router {
    address public factory;
    constructor(address f){factory=f;}
    struct ExactInputSingleParams {address tokenIn;address tokenOut;uint24 fee;address recipient;uint256 deadline;uint256 amountIn;uint256 amountOutMinimum;uint160 sqrtPriceLimitX96;}
    function exactInputSingle(ExactInputSingleParams calldata q) external returns(uint256) {
        require(q.deadline>=block.timestamp);
        IERC20(q.tokenIn).transferFrom(msg.sender,address(this),q.amountIn);
        BHMockToken(q.tokenOut).mint(q.recipient,q.amountIn);
        return q.amountIn;
    }
}
contract BHMockCurvePool {
    address public coin0;address public coin1;
    constructor(address a,address b){coin0=a;coin1=b;}
    function coins(uint256 index) external view returns(address){return index==0?coin0:coin1;}
    function price_oracle() external pure returns(uint256){return 1e18;}
    function exchange(int128 i,int128 j,uint256 amount,uint256 minDy) external returns(uint256){
        require(i==0 && j==1 && amount>=minDy);
        IERC20(coin0).transferFrom(msg.sender,address(this),amount);
        BHMockToken(coin1).mint(msg.sender,amount);
        return amount;
    }
}
contract BoostHubMultiOracleRoutesTest is Test {
    BoostHubEthereumRewardConverter ethConverter;
    BoostHubFraxtalRewardConverter fraConverter;
    BHMockToken a;BHMockToken b;BHMockToken c;
    BHMockV2Pair pair2;BHMockV2Router router2;
    BHMockV3Pool pair3;BHMockV3Router router3;
    BHMockCurvePool curve;
    function setUp() public {
        // Tests run against real Ethereum mainnet/fraxtal mainnet fork state.
        vm.createSelectFork(vm.envString("ETHEREUM_RPC"));
        ethConverter=new BoostHubEthereumRewardConverter(100,address(this));
        a=new BHMockToken("MockA");b=new BHMockToken("MockB");c=new BHMockToken("MockC");
        pair2=new BHMockV2Pair(address(a),address(b),address(this));
        router2=new BHMockV2Router(address(this));
        pair3=new BHMockV3Pool(address(b),address(c),address(this),3000);
        router3=new BHMockV3Router(address(this));
        curve=new BHMockCurvePool(address(a),address(b));
    }
    function _v2hop() internal view returns(BoostHubDexTwapRoutes.Hop memory h){
        h=BoostHubDexTwapRoutes.Hop({source:BoostHubDexTwapRoutes.Source.UniV2TWAP,pool:address(pair2),router:address(router2),tokenIn:address(a),tokenOut:address(b),fee:0,window:0,indexIn:0,indexOut:0,curveSwapType:0});
    }
    function _v3hop() internal view returns(BoostHubDexTwapRoutes.Hop memory h){
        h=BoostHubDexTwapRoutes.Hop({source:BoostHubDexTwapRoutes.Source.UniV3TWAP,pool:address(pair3),router:address(router3),tokenIn:address(b),tokenOut:address(c),fee:3000,window:1800,indexIn:0,indexOut:0,curveSwapType:0});
    }
    function test_V2PrimeRequiredFullWindowStalenessAndExecution() public {
        ethConverter.updateV2Oracle(address(pair2));
        vm.warp(block.timestamp+1799);
        vm.expectRevert(abi.encodeWithSelector(BoostHubDexTwapRoutes.TwapNotReady.selector,address(pair2)));
        ethConverter.updateV2Oracle(address(pair2));
        vm.warp(block.timestamp+1);
        ethConverter.updateV2Oracle(address(pair2));
        BoostHubDexTwapRoutes.Hop[] memory steps=new BoostHubDexTwapRoutes.Hop[](1);steps[0]=_v2hop();
        ethConverter.addDexRoute(address(a),address(b),steps);
        assertTrue(ethConverter.isSupportedPair(address(a),address(b)));
        a.mint(address(this),1 ether);a.approve(address(ethConverter),1 ether);
        assertEq(ethConverter.getAmountOut(address(a),address(b),1 ether),1 ether);
        assertEq(ethConverter.swap(address(a),address(b),1 ether),1 ether);
        assertEq(b.balanceOf(address(this)),1 ether);
        vm.warp(block.timestamp+3601);
        vm.expectRevert(abi.encodeWithSelector(BoostHubDexTwapRoutes.TwapStale.selector,address(pair2)));
        ethConverter.getAmountOut(address(a),address(b),1 ether);
    }
    function test_V3HistoricalMeanTickTwoHopAndNoSpotFallback() public {
        ethConverter.updateV2Oracle(address(pair2));
        vm.warp(block.timestamp+1800);
        ethConverter.updateV2Oracle(address(pair2));
        BoostHubDexTwapRoutes.Hop[] memory steps=new BoostHubDexTwapRoutes.Hop[](2);
        steps[0]=_v2hop();steps[1]=_v3hop();
        ethConverter.addDexRoute(address(a),address(c),steps);
        assertEq(ethConverter.getAmountOut(address(a),address(c),1 ether),1 ether);
        a.mint(address(this),1 ether);a.approve(address(ethConverter),1 ether);
        assertEq(ethConverter.swap(address(a),address(c),1 ether),1 ether);
        assertEq(c.balanceOf(address(this)),1 ether);
        pair3.setMeanTick(100);
        assertTrue(ethConverter.getAmountOut(address(a),address(c),1 ether)!=1 ether);
        pair3.setMeanTick(-500);
        assertTrue(ethConverter.getAmountOut(address(a),address(c),1 ether)<1 ether);
        ethConverter.setDexRoute(address(a),address(c),steps);
    }
    function test_CurveEMARegistrationAndDirectExecution() public {
        BoostHubDexTwapRoutes.Hop[] memory h=new BoostHubDexTwapRoutes.Hop[](1);
        h[0]=BoostHubDexTwapRoutes.Hop({source:BoostHubDexTwapRoutes.Source.CurveEMA,pool:address(curve),router:address(0),tokenIn:address(a),tokenOut:address(b),fee:0,window:0,indexIn:0,indexOut:1,curveSwapType:1});
        ethConverter.addDexRoute(address(a),address(b),h);
        assertEq(ethConverter.getAmountOut(address(a),address(b),1 ether),1 ether);
        a.mint(address(this),1 ether);a.approve(address(ethConverter),1 ether);
        assertEq(ethConverter.swap(address(a),address(b),1 ether),1 ether);
    }
    function test_FraxtalNewRouteAndOriginalRouteStillPresent() public {
        vm.createSelectFork(vm.envString("FRAXTAL_RPC"));
        fraConverter=new BoostHubFraxtalRewardConverter(100,address(this));
        assertEq(fraConverter.routeCount(),1);
        assertEq(fraConverter.getAmountOut(fraConverter.FXS(),fraConverter.SDFXS(),1 ether)>0,true);
        // mock pair/router are deployed on this fork too: v3 proves new route registry works.
        BHMockToken x=new BHMockToken("X");BHMockToken y=new BHMockToken("Y");
        BHMockV3Pool pool=new BHMockV3Pool(address(x),address(y),address(this),3000);
        BHMockV3Router r=new BHMockV3Router(address(this));
        BoostHubDexTwapRoutes.Hop[] memory h=new BoostHubDexTwapRoutes.Hop[](1);
        h[0]=BoostHubDexTwapRoutes.Hop({source:BoostHubDexTwapRoutes.Source.UniV3TWAP,pool:address(pool),router:address(r),tokenIn:address(x),tokenOut:address(y),fee:3000,window:1800,indexIn:0,indexOut:0,curveSwapType:0});
        fraConverter.addDexRoute(address(x),address(y),h);
        assertEq(fraConverter.routeCount(),2);
        assertTrue(fraConverter.isSupportedPair(address(x),address(y)));
        x.mint(address(this),1 ether);x.approve(address(fraConverter),1 ether);
        assertEq(fraConverter.swap(address(x),address(y),1 ether),1 ether);
        assertEq(y.balanceOf(address(this)),1 ether);
    }
}