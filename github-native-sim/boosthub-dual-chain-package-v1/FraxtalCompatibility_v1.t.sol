pragma solidity 0.8.28;
import {BoostHub} from "../contracts/BoostHub.sol";
import {StakeDaoMerkleClaimExecutor} from "../contracts/StakeDaoMerkleClaimExecutor.sol";
import {TokenMock,GaugeMock} from "./FunctionalVerification_v3.t.sol";

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

contract FraxtalCompatibilityTest {
    function testNoVlBoostRegistryStillAllowsGaugeOnlyCheckpoint()external{
        UrdMock urd=new UrdMock();StakeDaoMerkleClaimExecutor helper=new StakeDaoMerkleClaimExecutor(address(this),address(urd));
        BoostHub hub=new BoostHub(address(this),address(0),address(helper));
        uint256[] memory pids=new uint256[](0);require(hub.checkpoint(pids));
        require(hub.systemInfo().vlsdtDelegated==0);
    }
    function testUrdClaimUsesCumulativeDeltaAndPreservesMultiTokenHubInterface()external{
        (BoostHub hub,StakeDaoMerkleClaimExecutor helper,UrdMock urd,TokenMock reward)=fixture();
        bytes32[] memory proof=new bytes32[](0);urd.configure(address(hub),address(reward),1000);
        helper.supplyClaim(0,address(reward),0,1000,proof);hub.claimStakeDaoRewards(0);
        require(reward.balanceOf(address(hub))==1000);
        urd.configure(address(hub),address(reward),1500);
        helper.supplyClaim(0,address(reward),0,1500,proof);hub.claimStakeDaoRewards(0);
        require(reward.balanceOf(address(hub))==1500);require(urd.claimed(address(hub),address(reward))==1500);
    }
    function testUrdStaleProofCanBeCleared()external{
        (BoostHub hub,StakeDaoMerkleClaimExecutor helper,UrdMock urd,TokenMock reward)=fixture();
        bytes32[] memory proof=new bytes32[](0);urd.configure(address(hub),address(reward),1000);
        helper.supplyClaim(0,address(reward),0,1000,proof);urd.configure(address(hub),address(reward),1500);
        require(helper.clearStaleClaim(address(reward)));
    }
    function testUrdUnsafeRecipientIsRejected()external{
        (BoostHub hub,StakeDaoMerkleClaimExecutor helper,UrdMock urd,TokenMock reward)=fixture();
        urd.configure(address(hub),address(reward),1000);urd.setRecipient(address(hub),address(0x1234));
        bytes32[] memory proof=new bytes32[](0);
        (bool ok,)=address(helper).call(abi.encodeCall(helper.supplyClaim,(0,address(reward),0,1000,proof)));require(!ok);
    }
    function testUrdFailedClaimRemainsRetryable()external{
        (BoostHub hub,StakeDaoMerkleClaimExecutor helper,UrdMock urd,TokenMock reward)=fixture();
        urd.configure(address(hub),address(reward),1000);bytes32[] memory proof=new bytes32[](0);
        helper.supplyClaim(0,address(reward),0,1000,proof);urd.setFail(true);hub.claimStakeDaoRewards(0);
        (StakeDaoMerkleClaimExecutor.Claim memory c,)=helper.getClaim(address(reward));require(c.exists);
        urd.setFail(false);hub.claimStakeDaoRewards(0);require(reward.balanceOf(address(hub))==1000);
    }
    function testUrdMismatchRevertsTransferAndKeepsClaim()external{
        (BoostHub hub,StakeDaoMerkleClaimExecutor helper,UrdMock urd,TokenMock reward)=fixture();
        urd.configure(address(hub),address(reward),1000);bytes32[] memory proof=new bytes32[](0);
        helper.supplyClaim(0,address(reward),0,1000,proof);urd.setLie(true);hub.claimStakeDaoRewards(0);
        require(reward.balanceOf(address(hub))==0);require(urd.claimed(address(hub),address(reward))==0);
        (StakeDaoMerkleClaimExecutor.Claim memory c,)=helper.getClaim(address(reward));require(c.exists);
    }
    function fixture()internal returns(BoostHub hub,StakeDaoMerkleClaimExecutor helper,UrdMock urd,TokenMock reward){
        urd=new UrdMock();helper=new StakeDaoMerkleClaimExecutor(address(this),address(urd));
        hub=new BoostHub(address(this),address(1),address(helper));helper.setBoostHub(address(hub));
        TokenMock asset=new TokenMock();reward=new TokenMock();GaugeMock gauge=new GaugeMock(address(asset),address(reward));
        address[] memory assets=new address[](1);assets[0]=address(asset);address[] memory gauges=new address[](1);gauges[0]=address(gauge);
        address[][]memory tokens=new address[][](1);tokens[0]=new address[](1);tokens[0][0]=address(reward);hub.addPoolsBatch(assets,gauges,tokens);
        uint256[]memory pids=new uint256[](1);address[]memory depositor=new address[](1);depositor[0]=address(this);
        bool[]memory locks=new bool[](1);bytes4[]memory selectors=new bytes4[](1);selectors[0]=0x4b820093;
        BoostHub.FeeConfig[]memory fees=new BoostHub.FeeConfig[](1);fees[0]=BoostHub.FeeConfig(0,address(this));
        bool[]memory active=new bool[](1);active[0]=true;hub.setDepositors(pids,depositor,locks,selectors,fees,active);hub.executeTransactions();
        asset.mint(address(this),100);asset.approve(address(hub),100);hub.deposit(0,100);
    }
}
