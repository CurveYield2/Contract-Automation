// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// Candidate-bound audit-only harness: imports actual pinned production contracts.
import {FeeSettlementKeeper} from "../../contracts/FeeSettlementKeeper.sol";
import {FeeSettlementRouter} from "../../contracts/FeeSettlementRouter.sol";
import {PermanentLiquidityVaultV2} from "../../contracts/PermanentLiquidityVaultV2.sol";
import {RouteRegistry} from "../../contracts/RouteRegistry.sol";

interface VmLiteV1 {
    function prank(address caller) external;
    function expectRevert(bytes4 selector) external;
    function mockCall(address callee, bytes calldata data, bytes calldata returnData) external;
}
contract AuditTokenV1 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function transfer(address to, uint256 amount) external returns(bool) {
        require(balanceOf[msg.sender] >= amount, "TOKEN_BALANCE");
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    }
    function approve(address spender, uint256 amount) external returns(bool) {
        allowance[msg.sender][spender] = amount; return true;
    }
}
contract AuditProtocolFeesV1 {
    uint256 public fee;
    constructor(uint256 amount) { fee=amount; }
    function collectAggregateFees(address) external {}
    function withdrawProtocolFees(address, address) external {}
    function getProtocolFeeAmounts(address) external pure returns(uint256[] memory a) { a=new uint256[](1); }
    function getPoolCreatorFeeAmounts(address) external view returns(uint256[] memory a) {
        a=new uint256[](1); a[0]=fee;
    }
}
contract AuditRegistryV1 {
    function creatorControllerOf(address) external pure returns(address) { return address(0xA110); }
    function creatorPayoutReceiverOf(address) external pure returns(address) { return address(0xA111); }
    // Partner-PoL not configured: source's non-strict self-call catches this.
    fallback() external { revert("PARTNER_POL_UNCONFIGURED"); }
}
contract AuditAdminFeesV1 {
    AuditRegistryV1 public immutable registry;
    constructor(address r) { registry=AuditRegistryV1(r); }
    function quoteAdminAllocation(address, uint256[] calldata amounts) external pure returns(
        uint256[] memory a,uint256[] memory b,uint256[] memory c,uint256[] memory d
    ) {
        a=new uint256[](amounts.length); b=new uint256[](amounts.length);
        c=new uint256[](amounts.length); d=new uint256[](amounts.length);
    }
}
contract AuditCreatorFeesV1 {
    AuditTokenV1 public immutable token;
    uint256 public immutable amount;
    constructor(address t,uint256 a) { token=AuditTokenV1(t); amount=a; }
    function withdrawCreatorFeesToSettlementRouter() external { token.mint(msg.sender, amount); }
    function quoteCreatorAllocation(uint256[] calldata amounts) external pure returns(
        uint256[] memory personal,uint256[] memory admin,uint256[] memory permanent,
        uint256[] memory partner,uint256[] memory partnerAdmin
    ) {
        personal=new uint256[](amounts.length);
        admin=new uint256[](amounts.length);
        permanent=new uint256[](amounts.length);
        partner=new uint256[](amounts.length);
        partnerAdmin=new uint256[](amounts.length);
        for(uint256 i=0;i<amounts.length;i++) permanent[i]=amounts[i];
    }
}
contract CurveYieldDexPhase5BoundaryV1 {
    VmLiteV1 internal constant vm=VmLiteV1(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant POOL=address(0xCAFE);
    address internal constant ADVERSARY=address(0xBAD1);
    address internal constant OTHER=address(0xBAD2);
    address internal constant STORAGE=address(0xFEE1);
    address internal constant VAULT=address(0xBADD);
    address internal constant ROUTER_DEP=address(0xDEAD);
    address internal constant OWNER=address(0xABCD);
    function _settlementFixture(uint256 fee) internal returns(
        FeeSettlementRouter router,FeeSettlementKeeper keeper,AuditTokenV1 token
    ) {
        token=new AuditTokenV1();
        AuditRegistryV1 registry=new AuditRegistryV1();
        AuditAdminFeesV1 admin=new AuditAdminFeesV1(address(registry));
        AuditCreatorFeesV1 creator=new AuditCreatorFeesV1(address(token),fee);
        AuditProtocolFeesV1 protocol=new AuditProtocolFeesV1(fee);
        router=new FeeSettlementRouter(address(this),address(protocol),address(admin),
            address(0xBEEF),VAULT,ROUTER_DEP,address(0x7777),address(token));
        keeper=new FeeSettlementKeeper(address(router));
        router.setKeeper(address(keeper),true);
        router.setCreatorFeeSplitter(POOL,address(creator));
        router.setFeeConverterStorage(STORAGE);
        address[] memory tokens=new address[](1);
        tokens[0]=address(token);
        vm.mockCall(VAULT,abi.encodeWithSignature("getPoolTokens(address)",POOL),abi.encode(tokens));
        // No callable liquidityRouter.getPermit2 in this exact fixture: real
        // protected join fails and actual non-strict FeeSettlementRouter catches it.
    }
    function testFuzz_P4Cand001_PublicKeeperDrivesActualFallback(uint96 raw) public {
        uint256 fee=uint256(raw)%1e22+1;
        (FeeSettlementRouter router,FeeSettlementKeeper keeper,AuditTokenV1 token)=_settlementFixture(fee);
        vm.expectRevert(FeeSettlementRouter.UnauthorizedCollector.selector);
        vm.prank(ADVERSARY); router.collect(POOL);
        vm.prank(ADVERSARY); keeper.collect(POOL);
        require(token.balanceOf(STORAGE)==fee,"P4-CAND-001: FALLBACK_CUSTODY");
        require(token.balanceOf(address(router))==0,"P4-CAND-001: RESIDUE");
    }
    function _lotFixture(uint256 amount) internal returns(PermanentLiquidityVaultV2 pol) {
        RouteRegistry routes=new RouteRegistry(address(this));
        AuditTokenV1 bpt=new AuditTokenV1();
        pol=new PermanentLiquidityVaultV2(address(this),address(0x5100),VAULT,address(routes),address(0x5200));
        pol.setSettlementRouter(address(this));
        bpt.mint(address(pol),amount);
        pol.recordPermanentLiquidity(address(bpt),address(bpt),address(bpt),amount,
            PermanentLiquidityVaultV2.LiquidityOrigin.CreatorPermanentLiquidity,
            ADVERSARY,OTHER);
        pol.approveMigrationTarget(address(0x6000),true);
    }
    function _plan(uint256 amount) internal view returns(PermanentLiquidityVaultV2.MigrationPlan memory p) {
        PermanentLiquidityVaultV2.MigrationSwap[] memory swaps=new PermanentLiquidityVaultV2.MigrationSwap[](0);
        p=PermanentLiquidityVaultV2.MigrationPlan({
            lotId:1,targetPool:address(0x6000),sourceBptAmount:amount,
            sourceTokenSetHash:bytes32(uint256(1)),targetTokenSetHash:bytes32(uint256(2)),
            minSourceAmountsOut:new uint256[](0),swaps:swaps,
            minTargetBptOut:1,expiry:uint48(block.timestamp+1 days)
        });
    }
    function testFuzz_P4Cand002_StoredOldActorPersistsAndOwnerApproves(uint96 raw) public {
        uint256 amount=uint256(raw)%1e22+1;
        PermanentLiquidityVaultV2 pol=_lotFixture(amount);
        PermanentLiquidityVaultV2.MigrationPlan memory plan=_plan(amount);
        vm.prank(OWNER);
        vm.expectRevert(PermanentLiquidityVaultV2.NotCreatorMigrationApprover.selector);
        pol.requestCreatorMigration(plan);
        vm.prank(ADVERSARY);
        uint256 requestId=pol.requestCreatorMigration(plan);
        require(requestId==1,"P4-CAND-002: OLD_ACTOR");
        bytes[] memory routeData=new bytes[](0);
        vm.expectRevert(PermanentLiquidityVaultV2.CreatorMigrationNotApproved.selector);
        pol.executeCreatorMigration(requestId,plan,routeData);
        pol.approveCreatorMigration(requestId);
        plan.minTargetBptOut=2;
        vm.expectRevert(PermanentLiquidityVaultV2.MigrationPlanHashMismatch.selector);
        pol.executeCreatorMigration(requestId,plan,routeData);
    }
}
