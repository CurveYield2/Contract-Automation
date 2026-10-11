pragma solidity 0.8.28;
import {BoostHub} from "../contracts/BoostHub.sol";
import {StakeDaoFraxtalSdFxsUrdClaimExecutor} from "../contracts/StakeDaoFraxtalSdFxsUrdClaimExecutor_v5.sol";
import {TokenMock,GaugeMock,Staking} from "./FunctionalVerification_v3.t.sol";

contract UrdMock {
    bytes32 public root;
    mapping(address=>mapping(address=>uint256))public claimed;
    mapping(address=>address)public recipients;
    bool public fail;
    bool public lie;
    function configure(address account,address token,uint256 cumulative)external{
        root=keccak256(bytes.concat(keccak256(abi.encode(account,token,cumulative))));
        uint256 delta=cumulative-claimed[account][token];TokenMock(token).mint(address(this),delta);
    }
    function setRecipient(address account,address recipient)external{recipients[account]=recipient;}
    function setFail(bool v)external{fail=v;}
    function setLie(bool v)external{lie=v;}
    function claim(address account,address token,uint256 cumulative,bytes32[] calldata)external returns(uint256 delta){
        require(!fail);delta=cumulative-claimed[account][token];claimed[account][token]=cumulative;
        address receiver=recipients[account];if(receiver==address(0))receiver=account;
        require(TokenMock(token).transfer(receiver,delta));if(lie)return delta+1;
    }
}


interface FraxtalVm {
    function chainId(uint256) external;
    function etch(address, bytes calldata) external;
    function prank(address) external;
    function warp(uint256) external;
    function readFile(string calldata) external view returns (string memory);
    function parseBytes(string calldata) external pure returns (bytes memory);
}

contract FraxtalCompatibilityTest {
    FraxtalVm constant vm=FraxtalVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant TOKEN=0x1AEe2382e05Dc68BDfC472F1E46d570feCca5814;
    address constant URD=0xAeB87C92b2E7d3b21fA046Ae1E51E0ebF11A41Af;
    address constant USER=address(0xBEEF);
    address constant RECEIVER=address(0xFEED);
    BoostHub hub;StakeDaoFraxtalSdFxsUrdClaimExecutor helper;UrdMock urd;
    TokenMock reward;TokenMock second;GaugeMock gauge;
    function setUp()public {
        vm.chainId(252);vm.warp(1800000000/28800*28800);
        vm.etch(TOKEN,address(new TokenMock()).code);vm.etch(URD,address(new UrdMock()).code);
        reward=TokenMock(TOKEN);urd=UrdMock(URD);second=new TokenMock();
        helper=new StakeDaoFraxtalSdFxsUrdClaimExecutor(address(this));
        hub=new BoostHub(address(this),address(0),address(helper));helper.setBoostHub(address(hub));
        gauge=new GaugeMock(TOKEN,TOKEN);gauge.setReward(1,address(second));
        address[] memory assets=new address[](1);assets[0]=TOKEN;address[] memory gauges=new address[](1);gauges[0]=address(gauge);
        address[][]memory tokens=new address[][](1);tokens[0]=new address[](2);tokens[0][0]=TOKEN;tokens[0][1]=address(second);
        hub.addPoolsBatch(assets,gauges,tokens);configure(address(this),0,0x4b820093);
        reward.mint(address(this),100e18);reward.approve(address(hub),100e18);hub.deposit(0,100e18);
    }
    function configure(address depositor,uint16 fee,bytes4 selector)internal {
        uint256[]memory pids=new uint256[](1);address[]memory depositors=new address[](1);depositors[0]=depositor;
        bool[]memory locks=new bool[](1);bytes4[]memory selectors=new bytes4[](1);selectors[0]=selector;
        BoostHub.FeeConfig[]memory fees=new BoostHub.FeeConfig[](1);fees[0]=BoostHub.FeeConfig(fee,RECEIVER);
        bool[]memory active=new bool[](1);active[0]=true;hub.setDepositors(pids,depositors,locks,selectors,fees,active);hub.executeTransactions();
    }
    function supply(uint256 cumulative)internal {urd.configure(address(hub),TOKEN,cumulative);helper.supplyClaim(cumulative,new bytes32[](0));}
    function failed(address target,bytes memory data)internal returns(bool){(bool ok,)=target.call(data);return !ok;}
    function claimExists()internal view returns(bool){(StakeDaoFraxtalSdFxsUrdClaimExecutor.StoredClaim memory c,)=helper.getClaim();return c.exists;}
    function testNoVlBoostRegistryStillAllowsGaugeOnlyCheckpoint()external {
        require(hub.checkpoint(new uint256[](0)));require(hub.checkpoint(new uint256[](1)));
        require(hub.systemInfo().vlBoost==address(0)&&hub.systemInfo().vlsdtDelegated==0);
    }
    function testGaugeCheckpointStillRequiresConfiguredSelector()external {
        BoostHub unconfigured=new BoostHub(address(this),address(0),address(helper));
        address[]memory assets=new address[](1);assets[0]=TOKEN;address[]memory gauges=new address[](1);gauges[0]=address(gauge);
        address[][]memory tokens=new address[][](1);tokens[0]=new address[](0);unconfigured.addPoolsBatch(assets,gauges,tokens);
        require(failed(address(unconfigured),abi.encodeCall(unconfigured.checkpoint,(new uint256[](1)))));
    }
    function testClaimExecutorIsStillMandatory()external {
        try new BoostHub(address(this),address(0),address(0)) {revert("zero helper accepted");}catch{}
    }
    function testUrdClaimUsesCumulativeDeltaAndPreservesMultiTokenHubInterface()external {
        supply(1000);(address[] memory tokens,uint256[] memory amounts)=hub.claimStakeDaoRewards(0);
        require(tokens.length==2&&tokens[0]==TOKEN&&amounts[0]==1000&&amounts[1]==0);
        require(reward.balanceOf(address(hub))==1000&&!claimExists());
        supply(1500);hub.claimStakeDaoRewards(0);
        require(reward.balanceOf(address(hub))==1500&&urd.claimed(address(hub),TOKEN)==1500);
        require(hub.positionInfo(0,address(this)).pendingRewards[0]==1500);
    }
    function testPlatformFeeUsesActualUrdDelta()external {
        configure(address(this),500,0x4b820093);supply(1000e18);hub.claimStakeDaoRewards(0);
        require(reward.balanceOf(RECEIVER)==50e18&&hub.positionInfo(0,address(this)).pendingRewards[0]==950e18);
    }
    function testUrdStaleProofCanBeCleared()external {
        supply(1000);urd.configure(address(hub),TOKEN,1500);require(helper.clearStaleClaim()&&!claimExists());
    }
    function testUrdStaleProofIsSkippedAndInvalidatedByHub()external {
        supply(1000);urd.configure(address(hub),TOKEN,1500);hub.claimStakeDaoRewards(0);
        require(!claimExists()&&reward.balanceOf(address(hub))==0&&urd.claimed(address(hub),TOKEN)==0);
    }
    function testUrdUnsafeRecipientIsRejected()external {
        urd.configure(address(hub),TOKEN,1000);urd.setRecipient(address(hub),USER);
        require(failed(address(helper),abi.encodeCall(helper.supplyClaim,(1000,new bytes32[](0)))));
    }
    function testRecipientChangeCannotRedirectClaimAndCanBeCleared()external {
        supply(1000);urd.setRecipient(address(hub),USER);hub.claimStakeDaoRewards(0);
        require(claimExists()&&reward.balanceOf(USER)==0&&urd.claimed(address(hub),TOKEN)==0);
        require(helper.clearStaleClaim()&&!claimExists());
    }
    function testExplicitHubRecipientIsAllowed()external {
        urd.setRecipient(address(hub),address(hub));supply(1000);hub.claimStakeDaoRewards(0);
        require(reward.balanceOf(address(hub))==1000);
    }
    function testUrdFailedClaimRemainsRetryable()external {
        supply(1000);urd.setFail(true);hub.claimStakeDaoRewards(0);require(claimExists());
        urd.setFail(false);hub.claimStakeDaoRewards(0);require(reward.balanceOf(address(hub))==1000&&!claimExists());
    }
    function testUrdMismatchRevertsTransferAndKeepsClaim()external {
        supply(1000);urd.setLie(true);hub.claimStakeDaoRewards(0);
        require(reward.balanceOf(address(hub))==0&&urd.claimed(address(hub),TOKEN)==0&&claimExists());
        urd.setLie(false);hub.claimStakeDaoRewards(0);require(reward.balanceOf(address(hub))==1000);
    }
    function testOnlyHubMayExecutePerTokenClaim()external {
        supply(1000);require(failed(address(helper),abi.encodeCall(helper.claimToken,(0,TOKEN))));require(claimExists());
    }
    function testUnrelatedTokenAndPidAreSkipped()external {
        supply(1000);vm.prank(address(hub));helper.claimToken(1,TOKEN);
        vm.prank(address(hub));helper.claimToken(0,address(second));require(claimExists()&&reward.balanceOf(address(hub))==0);
    }
    function testMissingClaimIsSkipped()external {hub.claimStakeDaoRewards(0);require(reward.balanceOf(address(hub))==0);}
    function testOldExecuteSelectorIsAbsentAndNewCalldataMatchesHub()external {
        bytes[]memory calls=new bytes[](1);calls[0]=abi.encode(uint256(0));
        require(failed(address(helper),abi.encodeWithSignature("execute(bytes[])",calls)));
        require(keccak256(helper.buildBoostHubClaimCalldata())==keccak256(abi.encodeCall(hub.claimStakeDaoRewards,(0))));
    }
    function testBadProofAndCompletedCumulativeClaimsAreRejected()external {
        urd.configure(address(hub),TOKEN,1000);
        require(failed(address(helper),abi.encodeCall(helper.supplyClaim,(1001,new bytes32[](0)))));
        helper.supplyClaim(1000,new bytes32[](0));hub.claimStakeDaoRewards(0);
        require(failed(address(helper),abi.encodeCall(helper.supplyClaim,(1000,new bytes32[](0)))));
    }
    function testHubBindingIsConfiguratorOnlyAndPermanent()external {
        StakeDaoFraxtalSdFxsUrdClaimExecutor fresh=new StakeDaoFraxtalSdFxsUrdClaimExecutor(address(this));
        BoostHub next=new BoostHub(address(this),address(0),address(fresh));
        vm.prank(USER);require(failed(address(fresh),abi.encodeCall(fresh.setBoostHub,(address(next)))));
        fresh.setBoostHub(address(next));require(failed(address(fresh),abi.encodeCall(fresh.setBoostHub,(address(next)))));
    }
    function testBindingRejectsWrongExecutorHub()external {
        StakeDaoFraxtalSdFxsUrdClaimExecutor fresh=new StakeDaoFraxtalSdFxsUrdClaimExecutor(address(this));
        require(failed(address(fresh),abi.encodeCall(fresh.setBoostHub,(address(hub)))));
        require(failed(address(fresh),abi.encodeCall(fresh.supplyClaim,(1000,new bytes32[](0)))));
    }
    function testFraxtalHelperRejectsOtherChains()external {
        vm.chainId(1);try new StakeDaoFraxtalSdFxsUrdClaimExecutor(address(this)){revert("wrong chain accepted");}catch{}
    }
    function testFraxtalUrdRewardsReachUpdatedStakingAndPrincipalExits()external {
        hub.withdraw(0,100e18);
        address[8]memory tokens;tokens[0]=address(second);
        bytes memory code=vm.parseBytes(vm.readFile("evidence/staking.bytecode"));
        bytes memory init=abi.encodePacked(code,abi.encode(TOKEN,address(hub),uint256(0),address(this),tokens,RECEIVER,uint256(0),address(this)));
        address deployed;assembly{deployed:=create(0,add(init,32),mload(init))}require(deployed!=address(0));
        Staking staking=Staking(deployed);configure(deployed,500,0x4b820093);
        reward.mint(USER,100e18);vm.prank(USER);reward.approve(deployed,100e18);vm.prank(USER);staking.deposit(100e18);
        vm.warp(block.timestamp+45 days);supply(10e18);hub.claimStakeDaoRewards(0);staking.harvest();
        vm.prank(USER);staking.claim_rewards();require(reward.balanceOf(USER)==9.5e18&&reward.balanceOf(RECEIVER)==0.5e18);
        vm.prank(USER);staking.withdraw(100e18);require(reward.balanceOf(USER)==109.5e18&&staking.total_staked()==0);
    }
}
