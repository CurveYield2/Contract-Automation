// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

// Isolated fork test only. Does NOT modify the admitted source or production state.
// Contains only round-2 native base and real legacy-withdraw-manager experiments.
import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CurveYieldVaultBase1271} from "../../src/katana/CurveYieldVaultBase1271.sol";
import {CurveYieldSignatureFuse} from "../../src/katana/CurveYieldSignatureFuse.sol";
import {FuseAction} from "../../src/interfaces/CurveYieldPhase2Interfaces.sol";

interface INativeVaultR2 {
    function PLASMA_VAULT_BASE() external view returns (address);
    function isFuseSupported(address) external view returns (bool);
    function addFuses(address[] calldata) external;
    function execute(FuseAction[] calldata) external;
    function cap() external view returns (uint256);
    function nonces(address) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function permit(address,address,uint256,uint256,uint8,bytes32,bytes32) external;
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function allowance(address,address) external view returns (uint256);
    function asset() external view returns (address);
    function deposit(uint256,address) external returns (uint256);
    function redeemFromRequest(uint256,address,address) external returns (uint256);
    function transfer(address,uint256) external returns (bool);
    function convertToAssets(uint256) external view returns (uint256);
}
interface IRealOldWmR2 {
    struct Request {uint256 shares;uint256 endWithdrawWindowTimestamp;bool canWithdraw;uint256 withdrawWindowInSeconds;}
    function requestShares(uint256) external;
    function requestInfo(address) external view returns (Request memory);
    function getRequestFee() external view returns(uint256);
    function getSharesToRelease() external view returns(uint256);
    function getPlasmaVaultAddress() external view returns(address);
    function releaseFunds(uint256,uint256) external;
    function getLastReleaseFundsTimestamp() external view returns(uint256);
}
interface IAccessR2 {function hasRole(uint64,address) external view returns(bool,uint32);}
interface IOriginalBaseR2 {function ORIGINAL_BASE() external view returns(address);}
interface ISafeTxR2 {function isOwner(address) external view returns(bool);function getThreshold() external view returns(uint256);function execTransaction(address,uint256,bytes calldata,uint8,uint256,uint256,uint256,address,address,bytes calldata) external returns(bool);}

contract Round2Native_v1 is Test {
    address constant VAULT = 0xEd83daf48429cfb2C650Fd721b9241e180fd4548;
    address constant ORIGINAL = 0x6D73E66A5486C8Aa7DD8a3231F89087CE1D74b49;
    address constant PRESERVED = 0x0a9eA25C827Ec0C6B2619C231B7566846619B365;
    address constant OLD_WM = 0x59B340EAb30AFE0cecD51C609d3190e8C75C40AE;
    address constant ACCESS = 0xd7f408f203c5c6a76c9c55c9f6b015929F151fAA;
    address constant SAFE = 0x47623C62f281807D615eeb4A2CEee9d97F9D3C49;
    address constant DEPLOYER = 0x11b78837cadC8E894F1c6e13fA9f3A085a75FA35;
    address constant CONTROLLER = 0xbFdf2d2653859B66A8A15e1C85F6d6cdEe89698f;
    address constant RCM = 0xA77470B748A8Fb50056Ca3c07375dC76Aa3A72Cb;
    address constant CUSTODY = 0xe7D109Ce6b34447Dd45B54e5615F4177291D5ADf;
    address constant AVKAT = 0x7231dbaCdFc968E07656D12389AB20De82FbfCeB;
    uint256 constant FIRST_PK = 0xAB001;
    uint256 constant SECOND_PK = 0xAB002;
    INativeVaultR2 vault = INativeVaultR2(VAULT);
    IRealOldWmR2 oldWm = IRealOldWmR2(OLD_WM);

    function _probe(string memory label, address who, address target, bytes memory callData)
        internal returns (bool ok,bytes memory ret) {
        vm.prank(who);
        (ok,ret)=target.call(callData);
        emit log_named_string("R2_CALL",label);
        emit log_named_address("actor",who);
        emit log_named_address("target",target);
        emit log_named_bytes("calldata",callData);
        emit log_named_string("success",ok?"true":"false");
        emit log_named_bytes("return_or_revert",ret);
    }
    function _safeExec(string memory label,bytes memory data) internal returns(bool) {
        bytes memory prevalidated = abi.encodePacked(bytes32(uint256(uint160(DEPLOYER))),bytes32(0),uint8(1));
        emit log_named_string("R2_SAFE_OWNER_OPERATION",label);
        emit log_named_uint("safe_threshold",ISafeTxR2(SAFE).getThreshold());
        emit log_named_string("deployer_is_safe_owner",ISafeTxR2(SAFE).isOwner(DEPLOYER)?"true":"false");
        vm.prank(DEPLOYER);
        try ISafeTxR2(SAFE).execTransaction(VAULT,0,data,0,0,0,0,address(0),address(0),prevalidated)
          returns(bool success) {
            emit log_named_string("safe_authorized_exec",success?"true":"false");
            return success;
        } catch(bytes memory failure) {
            emit log_named_bytes("safe_exec_revert",failure);
            return false;
        }
    }
    function _nativeSnapshot(string memory label,address owner) internal {
        emit log_named_string("R2_NATIVE_SNAPSHOT",label);
        emit log_named_address("activeBase",vault.PLASMA_VAULT_BASE());
        (bool c,bytes memory capRet)=VAULT.staticcall(abi.encodeWithSignature("cap()"));
        emit log_named_string("cap_success",c?"true":"false");
        emit log_named_bytes("cap_return",capRet);
        (bool n,bytes memory nonceRet)=VAULT.staticcall(abi.encodeWithSignature("nonces(address)",owner));
        emit log_named_string("nonce_success",n?"true":"false");
        emit log_named_bytes("nonce_return",nonceRet);
        emit log_named_uint("vault_shares",vault.balanceOf(owner));
        emit log_named_uint("vault_total_supply",vault.totalSupply());
    }
    function _permit(address owner,uint256 pk,uint256 value)
        internal returns (bool,bytes memory) {
        bytes32 domain=vault.DOMAIN_SEPARATOR();
        uint256 nonce=vault.nonces(owner);
        uint256 deadline=block.timestamp+3600;
        bytes32 typed=keccak256(abi.encode(
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
            owner,address(this),value,nonce,deadline));
        bytes32 digest=keccak256(abi.encodePacked(hex"1901",domain,typed));
        (uint8 v,bytes32 r,bytes32 s)=vm.sign(pk,digest);
        return _probe("native_permit",owner,VAULT,abi.encodeWithSignature(
            "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
            owner,address(this),value,deadline,v,r,s));
    }
    function test_R2_nativeBaseRealSelectorsAndAuthorizedInstallation() public {
        emit log_named_uint("fork_chain",block.chainid);
        emit log_named_uint("fork_block",block.number);
        emit log_named_bytes32("previous_block_hash",blockhash(block.number-1));
        emit log_named_bytes32("vault_codehash",VAULT.codehash);
        emit log_named_bytes32("original_native_base_codehash",ORIGINAL.codehash);
        emit log_named_bytes32("preserved_wrapper_codehash",PRESERVED.codehash);
        emit log_named_address("preserved_original",IOriginalBaseR2(PRESERVED).ORIGINAL_BASE());
        assertEq(block.chainid,747474);
        assertGt(VAULT.code.length,0);assertGt(ORIGINAL.code.length,0);
        assertEq(vault.PLASMA_VAULT_BASE(),PRESERVED,"preserved original fork required");
        address user=vm.addr(FIRST_PK);
        _nativeSnapshot("preserved installed route",user);
        uint256 capBefore=vault.cap();
        emit log_named_uint("native_preserved_cap",capBefore);
        (bool healthy,bytes memory retval)=_permit(user,FIRST_PK,7);
        emit log_named_string("preserved_original_permit",healthy?"PASS":"FAIL");
        emit log_named_bytes("preserved_permit_response",retval);
        emit log_named_uint("preserved_nonce_after_permit",vault.nonces(user));
        assertTrue(healthy,"healthy installed native permit control must work");
        assertEq(vault.nonces(user),1,"healthy native nonce must increment");
        CurveYieldSignatureFuse uninstallFuse = new CurveYieldSignatureFuse(7,VAULT,PRESERVED);
        address[] memory u = new address[](1);u[0]=address(uninstallFuse);
        bool reg=_safeExec("authorized_add_uninstaller",abi.encodeCall(INativeVaultR2.addFuses,(u)));
        emit log_named_string("uninstall_registry_access",reg?"AUTHORIZED":"BLOCKED");
        if(!reg)return;
        FuseAction[] memory act=new FuseAction[](1);
        act[0]=FuseAction(address(uninstallFuse),abi.encodeCall(CurveYieldSignatureFuse.uninstall,()));
        (bool execOld,)=_probe("authorized_uninstall_preserved",DEPLOYER,VAULT,
            abi.encodeCall(INativeVaultR2.execute,(act)));
        emit log_named_string("old_wrapper_native_rollback",execOld?"AUTHORIZED":"BLOCKED");
        if(!execOld)return;
        assertEq(vault.PLASMA_VAULT_BASE(),ORIGINAL,"after lawful rollback base must be native");
        uint256 directCap=vault.cap();
        emit log_named_uint("healthy_original_native_cap",directCap);
        assertEq(directCap,capBefore);
        address other=vm.addr(SECOND_PK);
        (bool healthy2,)=_permit(other,SECOND_PK,17);
        assertTrue(healthy2,"healthy unwrapped native permit");
        assertEq(vault.nonces(other),1,"native permit consumed nonce");
        CurveYieldVaultBase1271 admitted=new CurveYieldVaultBase1271(ORIGINAL);
        emit log_named_bytes32("admitted_wrapper_runtime_hash",address(admitted).codehash);
        CurveYieldSignatureFuse installer=new CurveYieldSignatureFuse(7,VAULT,address(admitted));
        u[0]=address(installer);
        bool registered=_safeExec("authorized_add_admitted_installer",abi.encodeCall(INativeVaultR2.addFuses,(u)));
        if(!registered){emit log_string("R2_SOURCE_INSTALL_BLOCKED_ADD_FUSE");return;}
        act[0]=FuseAction(address(installer),abi.encodeCall(CurveYieldSignatureFuse.install,()));
        (bool installed,)=_probe("authorized_install_admitted_source",DEPLOYER,VAULT,
            abi.encodeCall(INativeVaultR2.execute,(act)));
        if(!installed){emit log_string("R2_SOURCE_INSTALL_BLOCKED_EXECUTE");return;}
        assertEq(vault.PLASMA_VAULT_BASE(),address(admitted),"admitted real native wrapper installed");
        _nativeSnapshot("admitted source on real native vault",other);
        (bool okCap,bytes memory rawCap)=VAULT.staticcall(abi.encodeWithSignature("cap()"));
        emit log_named_string("admitted_cap_call",okCap?"OK":"REVERT");
        emit log_named_bytes("admitted_cap_return",rawCap);
        if(okCap && rawCap.length>=32)emit log_named_uint("admitted_cap_value",abi.decode(rawCap,(uint256)));
        (bool okNonce,bytes memory rawNonce)=VAULT.staticcall(abi.encodeWithSignature("nonces(address)",other));
        emit log_named_string("admitted_nonce_call",okNonce?"OK":"REVERT");
        if(okNonce && rawNonce.length>=32)emit log_named_uint("admitted_nonce_value",abi.decode(rawNonce,(uint256)));
        (bool okPermit,bytes memory permitRet)=_permit(other,SECOND_PK,29);
        emit log_named_string("admitted_native_permit",okPermit?"OK":"REVERT");
        emit log_named_bytes("admitted_permit_return",permitRet);
        emit log_named_uint("admitted_owner_shares",vault.balanceOf(other));
        emit log_named_uint("admitted_owner_allowance",vault.allowance(other,address(this)));
        emit log_named_uint("admitted_total_supply",vault.totalSupply());
        if(okCap && rawCap.length>=32 && abi.decode(rawCap,(uint256))!=capBefore)
            emit log_string("R2_CONFIRMED_NONTRIVIAL_NATIVE_CAP_MISMATCH");
        if(okNonce && rawNonce.length>=32 && abi.decode(rawNonce,(uint256))!=1)
            emit log_string("R2_CONFIRMED_NATIVE_NONCE_CONTEXT_MISMATCH");
        if(!okPermit)emit log_string("R2_CONFIRMED_AUTHORIZED_NATIVE_PERMIT_REVERT");
    }
    function test_R2_realOldManagerNonzeroClaimAndCutoverPreconditions() public {
        emit log_named_uint("fork_chain",block.chainid);
        emit log_named_uint("fork_block",block.number);
        emit log_named_bytes32("old_manager_codehash",OLD_WM.codehash);
        emit log_named_address("old_manager_vault",oldWm.getPlasmaVaultAddress());
        emit log_named_uint("old_request_fee",oldWm.getRequestFee());
        emit log_named_uint("old_released_shares",oldWm.getSharesToRelease());
        emit log_named_address("asset",vault.asset());
        assertEq(oldWm.getPlasmaVaultAddress(),VAULT,"required real old WM");
        address[8] memory donors=[DEPLOYER,SAFE,CUSTODY,RCM,CONTROLLER,OLD_WM,VAULT,AVKAT];
        address[3] memory claimants=[vm.addr(0xAC101),vm.addr(0xAC102),vm.addr(0xAC103)];
        uint256 funded;
        for(uint256 i;i<donors.length;i++){
            uint256 shares=vault.balanceOf(donors[i]);
            uint256 assets=IERC20(vault.asset()).balanceOf(donors[i]);
            emit log_named_address("candidate_legitimate_share_owner",donors[i]);
            emit log_named_uint("share_owner_balance",shares);
            emit log_named_uint("asset_owner_balance",assets);
            if(donors[i]==VAULT || donors[i]==OLD_WM || donors[i].code.length>0)continue;
            if(shares<3e8 && assets>=3e8){
                uint256 input=assets/1000;if(input>3e18)input=3e18;
                (bool approved,)=_probe("real_asset_holder_vault_deposit_approve",donors[i],vault.asset(),
                    abi.encodeWithSignature("approve(address,uint256)",VAULT,input));
                if(approved){
                    (bool deposited,)=_probe("real_asset_holder_vault_deposit",donors[i],VAULT,
                        abi.encodeCall(INativeVaultR2.deposit,(input,donors[i])));
                    if(deposited)shares=vault.balanceOf(donors[i]);
                }
            }
            if(shares>=3e8 && funded<3){
                uint256 amount=shares/1000;if(amount>1e18)amount=1e18;
                for(uint256 j=0;j<3 && funded<3;j++){
                    (bool moved,)=_probe("real_owner_share_transfer_to_test_claimant",donors[i],VAULT,
                        abi.encodeCall(INativeVaultR2.transfer,(claimants[funded],amount)));
                    if(moved){emit log_named_uint("actually_transferred_shares",amount);funded++;}
                }
            }
        }
        emit log_named_uint("funded_test_claimant_classes",funded);
        for(uint256 i;i<funded;i++){
            uint256 owned=vault.balanceOf(claimants[i]);
            emit log_named_uint("claimant_owner_share_pre",owned);
            (bool ok,bytes memory ret)=_probe("oldWM_actual_requestShares",claimants[i],OLD_WM,
                abi.encodeCall(IRealOldWmR2.requestShares,(owned/2)));
            emit log_named_string("claim_setup",ok?"SUCCESS":"REVERT");
            emit log_named_bytes("claim_setup_return",ret);
            IRealOldWmR2.Request memory info=oldWm.requestInfo(claimants[i]);
            emit log_named_address("claimant",claimants[i]);
            emit log_named_uint("old_real_request_shares",info.shares);
            emit log_named_uint("old_window_end",info.endWithdrawWindowTimestamp);
            emit log_named_string("old_claim_can_withdraw",info.canWithdraw?"true":"false");
        }
        // Always report actual role/allowance state; do not fabricate nonzero classes.
        (bool alphaOld,)=IAccessR2(ACCESS).hasRole(200,OLD_WM);
        (bool alphaController,)=IAccessR2(ACCESS).hasRole(200,CONTROLLER);
        emit log_named_string("old_WM_ALPHA",alphaOld?"true":"false");
        emit log_named_string("old_controller_ALPHA",alphaController?"true":"false");
        emit log_named_uint("old_WM_share_fee_escrow",vault.balanceOf(OLD_WM));
        emit log_named_uint("new_cutover_pre_totalSupply",vault.totalSupply());
        // No storage imitation, fake settlement, expiry advancement, or direct privileges.
        // If no three authentic funded pending/released/fee classes are available,
        // the final security disposition MUST remain INCONCLUSIVE.
        if(funded<3)emit log_string("R2_INCOMPLETE_AUTHENTIC_NONZERO_LEGACY_CLASS_SETUP");
    }
}
