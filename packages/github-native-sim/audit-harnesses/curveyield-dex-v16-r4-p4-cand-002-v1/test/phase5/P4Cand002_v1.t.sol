// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {PermanentLiquidityVaultV2} from "../../contracts/PermanentLiquidityVaultV2.sol";
import {PoolFeePolicyRegistry} from "../../contracts/PoolFeePolicyRegistry.sol";

contract Cand002BptV1 {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address, uint256) external pure returns (bool) { return true; }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "BAL");
        unchecked { balanceOf[msg.sender] -= amount; }
        balanceOf[to] += amount;
        return true;
    }
}

contract Cand002CreatorSyncV1 {
    uint256 public syncCount;
    function syncCreatorSwapFee() external { ++syncCount; }
}

contract Cand002ActorV1 {
    function acceptController(PoolFeePolicyRegistry registry, address pool) external {
        registry.acceptCreatorControllerTransfer(pool);
    }

    function setPayoutReceiver(PoolFeePolicyRegistry registry, address pool, address receiver) external {
        registry.setCreatorPayoutReceiver(pool, receiver);
    }

    function request(
        PermanentLiquidityVaultV2 vault,
        PermanentLiquidityVaultV2.MigrationPlan calldata plan
    ) external returns (bool ok, uint256 requestId) {
        try vault.requestCreatorMigration(plan) returns (uint256 id) {
            return (true, id);
        } catch {
            return (false, 0);
        }
    }
}

contract P4Cand002HarnessV1 {
    uint256 internal constant LOT_AMOUNT = 1e24;

    Cand002BptV1 public bpt;
    Cand002CreatorSyncV1 public creatorSync;
    Cand002ActorV1 public oldController;
    Cand002ActorV1 public oldPayoutReceiver;
    Cand002ActorV1 public newController;
    Cand002ActorV1 public newPayoutReceiver;

    PermanentLiquidityVaultV2 public permanentVault;
    PoolFeePolicyRegistry public registry;

    address public pool;
    address public migrationTarget;
    uint256 public lotId;
    uint256 public actionCount;
    uint256 public oldAuthoritySuccesses;
    uint256 public newAuthoritySuccesses;

    constructor() {
        bpt = new Cand002BptV1();
        creatorSync = new Cand002CreatorSyncV1();
        oldController = new Cand002ActorV1();
        oldPayoutReceiver = new Cand002ActorV1();
        newController = new Cand002ActorV1();
        newPayoutReceiver = new Cand002ActorV1();

        pool = address(bpt);
        migrationTarget = address(0xCAFE2002);

        permanentVault = new PermanentLiquidityVaultV2(
            address(this),
            address(0x1001),
            address(0x1002),
            address(0x1003),
            address(0x1004)
        );
        permanentVault.setSettlementRouter(address(this));
        bpt.mint(address(permanentVault), LOT_AMOUNT);
        lotId = permanentVault.recordPermanentLiquidity(
            pool,
            pool,
            pool,
            LOT_AMOUNT,
            PermanentLiquidityVaultV2.LiquidityOrigin.CreatorPermanentLiquidity,
            address(oldController),
            address(oldPayoutReceiver)
        );
        permanentVault.approveMigrationTarget(migrationTarget, true);

        registry = new PoolFeePolicyRegistry(address(this), address(0x2001));
        PoolFeePolicyRegistry.CreatorFeeConfig memory creatorConfig =
            PoolFeePolicyRegistry.CreatorFeeConfig({
                creatorPersonalBps: 0,
                creatorPermanentLiquidityBps: 0,
                creatorPartnerRevenueBps: 0
            });
        PoolFeePolicyRegistry.AdminFeeConfig memory adminConfig =
            PoolFeePolicyRegistry.AdminFeeConfig({
                adminCreatorPermanentLiquidityBps: 0,
                adminExtraPermanentPoLBps: 0,
                adminPartnerRevenueBps: 0
            });
        PoolFeePolicyRegistry.PartnerPoLConfig memory partnerConfig =
            PoolFeePolicyRegistry.PartnerPoLConfig({enabled: false, targetPool: address(0)});

        registry.registerPool(
            pool,
            0,
            address(creatorSync),
            address(oldController),
            address(oldPayoutReceiver),
            address(0),
            address(0),
            creatorConfig,
            adminConfig,
            partnerConfig
        );

        registry.requestCreatorControllerTransfer(pool, address(newController));
        newController.acceptController(registry, pool);
        newController.setPayoutReceiver(registry, pool, address(newPayoutReceiver));

        require(registry.creatorControllerOf(pool) == address(newController), "ROTATE_CONTROLLER");
        require(registry.creatorPayoutReceiverOf(pool) == address(newPayoutReceiver), "ROTATE_RECEIVER");
        require(registry.creatorControllerEpochOf(pool) == 1, "EPOCH");
    }

    function _amount(uint256 raw) internal pure returns (uint256) {
        return (raw % LOT_AMOUNT) + 1;
    }

    function _plan(uint256 amount)
        internal
        view
        returns (PermanentLiquidityVaultV2.MigrationPlan memory plan)
    {
        uint256[] memory minSource = new uint256[](0);
        PermanentLiquidityVaultV2.MigrationSwap[] memory swaps =
            new PermanentLiquidityVaultV2.MigrationSwap[](0);
        plan = PermanentLiquidityVaultV2.MigrationPlan({
            lotId: lotId,
            targetPool: migrationTarget,
            sourceBptAmount: amount,
            sourceTokenSetHash: keccak256("source-token-set-v1"),
            targetTokenSetHash: keccak256("target-token-set-v1"),
            minSourceAmountsOut: minSource,
            swaps: swaps,
            minTargetBptOut: 1,
            expiry: uint48(block.timestamp + 365 days)
        });
    }

    function action_staleAuthority(uint256 rawAmount) public {
        PermanentLiquidityVaultV2.MigrationPlan memory plan = _plan(_amount(rawAmount));

        (bool oldControllerOk,) = oldController.request(permanentVault, plan);
        (bool oldReceiverOk,) = oldPayoutReceiver.request(permanentVault, plan);
        (bool newControllerOk,) = newController.request(permanentVault, plan);
        (bool newReceiverOk,) = newPayoutReceiver.request(permanentVault, plan);

        require(oldControllerOk, "OLD_CONTROLLER_REVOKED");
        require(oldReceiverOk, "OLD_RECEIVER_REVOKED");
        require(!newControllerOk, "NEW_CONTROLLER_GRANTED");
        require(!newReceiverOk, "NEW_RECEIVER_GRANTED");

        oldAuthoritySuccesses += 2;
        if (newControllerOk) ++newAuthoritySuccesses;
        if (newReceiverOk) ++newAuthoritySuccesses;
        ++actionCount;
    }

    function property_stale_snapshot_survives_registry_rotation() external view returns (bool) {
        (
            ,
            ,
            ,
            ,
            ,
            address lotController,
            address lotPayoutReceiver
        ) = permanentVault.liquidityLots(lotId);

        return registry.creatorControllerOf(pool) == address(newController)
            && registry.creatorPayoutReceiverOf(pool) == address(newPayoutReceiver)
            && lotController == address(oldController)
            && lotPayoutReceiver == address(oldPayoutReceiver)
            && oldAuthoritySuccesses == actionCount * 2
            && newAuthoritySuccesses == 0;
    }
}

contract P4Cand002TestV1 is P4Cand002HarnessV1 {
    function test_rotatedRegistryDoesNotRevokeOldLotAuthority_v1() external {
        action_staleAuthority(123456);
        require(actionCount == 1, "ACTION");
        require(oldAuthoritySuccesses == 2, "OLD");
        require(newAuthoritySuccesses == 0, "NEW");
    }

    function testFuzz_staleLotAuthorityPersists_v1(uint256 rawAmount) external {
        action_staleAuthority(rawAmount);
        require(oldAuthoritySuccesses == 2, "OLD");
        require(newAuthoritySuccesses == 0, "NEW");
    }
}
