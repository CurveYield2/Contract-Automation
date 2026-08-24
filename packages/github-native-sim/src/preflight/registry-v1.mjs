import { preflightWorkflowV1 } from './workflow-v1.mjs';
import { preflightRequestSubmitV1 } from './request-submit-v1.mjs';
import { preflightFileTransferV1 } from './file-transfer-v1.mjs';
import { preflightFileMoveV1 } from './file-move-v1.mjs';
import { preflightBranchPrV1 } from './branch-pr-v1.mjs';
import { preflightSourceStagingV1 } from './source-staging-v1.mjs';
import { preflightCompileV1 } from './compile-v1.mjs';
import { preflightSlitherV1 } from './slither-v1.mjs';
import { preflightMedusaV1 } from './medusa-v1.mjs';
import { preflightFoundryV1 } from './foundry-v1.mjs';
import { preflightAnvilSimulationV1 } from './anvil-simulation-v1.mjs';
import { preflightLiveReadProbeV1 } from './live-read-probe-v1.mjs';
import { preflightRemediationRerunV1 } from './remediation-rerun-v1.mjs';
import { preflightPublicationV1 } from './publication-v1.mjs';
import { preflightDestructiveCleanupV1 } from './destructive-cleanup-v1.mjs';
export const TARGETED_PREFLIGHTS_V1=Object.freeze({'workflow':preflightWorkflowV1,'request-submit':preflightRequestSubmitV1,'file-transfer':preflightFileTransferV1,'file-move':preflightFileMoveV1,'branch-pr':preflightBranchPrV1,'source-staging':preflightSourceStagingV1,'compile':preflightCompileV1,'slither':preflightSlitherV1,'medusa':preflightMedusaV1,'foundry':preflightFoundryV1,'anvil-simulation':preflightAnvilSimulationV1,'live-read-probe':preflightLiveReadProbeV1,'remediation-rerun':preflightRemediationRerunV1,'publication':preflightPublicationV1,'destructive-cleanup':preflightDestructiveCleanupV1});
export const OPERATION_CLASSES=Object.freeze(Object.keys(TARGETED_PREFLIGHTS_V1));
export function runTargetedPreflightV1(operationClass, config){const fn=TARGETED_PREFLIGHTS_V1[operationClass];if(!fn) throw new Error(`Unknown mandatory preflight operation class: ${String(operationClass)}`);if(config?.operationClass!==undefined&&config.operationClass!==operationClass) throw new Error(`Preflight operation mismatch: CLI requested ${operationClass} but config declares ${config.operationClass}`);return fn({...config,operationClass});}
