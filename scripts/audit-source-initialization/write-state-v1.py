#!/usr/bin/env python3
import json, os
from pathlib import Path
e=os.environ
workspace=e["CAMPAIGN_ROOT"]
source={
 "kind":"URL_INITIALIZED_EXACT_ARCHIVE","originProvider":e["SOURCE_PROVIDER"],"originUrl":e["SOURCE_URL_CANONICAL"],
 "uploadedFilename":e["SOURCE_FILENAME"],"packageTitle":Path(e["SOURCE_FILENAME"]).stem,"sha256":e["SOURCE_SHA"],
 "byteLength":int(e["SOURCE_SIZE"]),"archiveTransferredToGitHub":True,"archiveRepository":"CurveYield2/Audit-Controller",
 "archiveCommit":e["ADMISSION_COMMIT"],"archivePath":e["SOURCE_PATH"],"archiveGitBlobSha":e["SOURCE_BLOB"],
 "extractedContentPath":e["SOURCE_DIR"],"extractedTreeSha256":e["TREE_SHA"]
}
routing={"mode":"LITE","workers":[
 {"lineage":"web-bootstrap-agent","phases":[0],"milestone":"P0_BOOTSTRAP","status":"ACTIVE"},
 {"lineage":"reviewer-1","model":"gpt-5.6-terra","reasoning":"high","phases":[1],"milestone":"P1","status":"NOT_STARTED"},
 {"lineage":"reviewer-2","model":"gpt-5.6-sol","reasoning":"high","phases":[2,3,4,5],"milestone":"P2_5","status":"NOT_STARTED"},
 {"lineage":"reviewer-3L","model":"gpt-5.6-sol","reasoning":"high","phases":[6,7],"milestone":"P6_7","status":"NOT_STARTED"},
 {"lineage":"reviewer-4","model":"gpt-5.6-sol","reasoning":"high","phases":[8,9,10],"milestone":"P8_10","status":"NOT_STARTED"}],
 "handoffs":["P0_TO_P1","P1_TO_P2","P5_TO_P6","P67_TO_P8"]}
state={"schemaVersion":"audit-v7-campaign-state-v1","campaignId":e["CAMPAIGN_ID"],"campaignGenerationId":e["GENERATION_ID"],
 "projectSlug":e["SLUG"],"title":e["CAMPAIGN_NAME"],"auditName":e["CAMPAIGN_NAME"],
 "assuranceMode":{"mode":"LITE","activation":"Audit Source Initialization created a fresh Lite campaign from one ZIP URL.",
  "authority":e["SKILL_REPO_PATH"],"liteRelease":e["SKILL_RELEASE"],"packageRevision":e["SKILL_REVISION"]},
 "controller":{"repository":"CurveYield2/Audit-Controller","branch":"main","workspacePath":workspace},
 "activeReviewer":{"lineage":"web-bootstrap-agent","executorClass":"CHATGPT_WEB_CHAT_GITHUB_CONNECTOR","authority":"MECHANICAL_ONLY",
  "authorizedPhases":[0],"session":e["SESSION"],"activation":"ACTIVE_FRESH_PHASE0"},
 "source":source,"sourceFenceStatus":"BOUND","phase":{"sequence":0,"id":"phase-0","revision":"v1","state":"ACTIVE","milestoneId":"P0_BOOTSTRAP"},
 "history":[],"skillAuthority":{"status":"BOUND","current":{"repository":"CurveYield2/Contract-Automation","ref":"main",
  "homepagePath":"optional-modes/lite-pathway/SKILL.md","liteSkillPath":e["SKILL_REPO_PATH"].split("CurveYield2/Contract-Automation/",1)[-1],
  "liteSkillBlobSha":e["SKILL_BLOB"],"liteSkillSha256":e["SKILL_SHA"],"liteRelease":e["SKILL_RELEASE"],
  "packageRevision":e["SKILL_REVISION"],"authorityBasis":"CURRENT_AUDIT_CONTROLLER_AUTHORITY_FOLDER"},
  "acceptedTechnicalEvidenceInvalidated":[],"phaseRestartRequired":False},
 "routingPlan":routing,"campaignCompletionStatus":"NOT_COMPLETE","createdAt":e["CREATED_AT"],"updatedAt":e["CREATED_AT"]}
pointer={"schemaVersion":"audit-v7-active-pointer-v1","projectSlug":e["SLUG"],"campaignId":e["CAMPAIGN_ID"],
 "campaignGenerationId":e["GENERATION_ID"],"phaseSequence":0,"currentSubphase":None,"status":"ACTIVE",
 "sourceRepository":"CurveYield2/Audit-Controller","sourcePath":e["SOURCE_PATH"],"sourceArchiveSha256":e["SOURCE_SHA"],
 "sourceGitBlobSha1":e["SOURCE_BLOB"],"sourceAdmissionCommit":e["ADMISSION_COMMIT"],"controllerBranch":"main",
 "workspacePath":workspace+"/","requiredSkillReleaseIdentity":e["SKILL_RELEASE"],"requiredSkillPackageRevision":e["SKILL_REVISION"],
 "reviewerLineage":"web-bootstrap-agent","activeReviewerIdentity":e["SESSION"],"stateReference":f"{workspace}/controller/CAMPAIGN_STATE_v1.json",
 "lastSealedPhase":None,"campaignCompletionStatus":"NOT_COMPLETE","sealedThroughPhase":None,
 "skillAuthorityReference":e["SKILL_REPO_PATH"],"phaseStatus":"PHASE0_ACTIVE_FRESH","lastUpdatedAt":e["CREATED_AT"]}
solo={"schemaVersion":"audit-v7-lite-audit-state-v38","processId":"audit-v7-independent-review-lite","mode":"LITE",
 "activationEvidence":"Created mechanically by Audit Source Initialization from one direct ZIP URL.",
 "campaign":{"campaignId":e["CAMPAIGN_ID"],"campaignGenerationId":e["GENERATION_ID"],"controllerBranch":"main","workspacePath":workspace,
  "campaignLink":f"https://github.com/CurveYield2/Audit-Controller/tree/main/{workspace.replace(' ','%20')}"},
 "inputs":{"sourceZip":{"fileName":e["SOURCE_FILENAME"],"localPath":e["SOURCE_PATH"],"sha256":e["SOURCE_SHA"],
   "byteLength":int(e["SOURCE_SIZE"]),"gitBlobSha":e["SOURCE_BLOB"],"admissionCommit":e["ADMISSION_COMMIT"]},
  "unpackedSource":{"localPath":e["SOURCE_DIR"],"treeSha256":e["TREE_SHA"]},
  "sourceIdentity":f"CurveYield2/Audit-Controller@{e['ADMISSION_COMMIT']}:{e['SOURCE_PATH']}#sha256={e['SOURCE_SHA']}",
  "buildIdentity":"PENDING_PHASE0_AUTOMATION"},
 "active":{"milestone":"P0_BOOTSTRAP","segment":0,"reviewer":"web-bootstrap-agent","status":"ACTIVE"},
 "reviewers":{"reviewer-1":{"model":"gpt-5.6-terra","reasoning":"high","phases":[1]},
  "reviewer-2":{"model":"gpt-5.6-sol","reasoning":"high","phases":[2,3,4,5]},
  "reviewer-3L":{"model":"gpt-5.6-sol","reasoning":"high","phases":[6,7]},
  "reviewer-4":{"model":"gpt-5.6-sol","reasoning":"high","phases":[8,9,10]}},
 "handoffs":{"P0_TO_P1":{"status":"NOT_CREATED","reference":None,"receipt":None},"P1_TO_P2":{"status":"NOT_CREATED","reference":None,"receipt":None},
  "P5_TO_P6":{"status":"NOT_CREATED","reference":None,"receipt":None},"P67_TO_P8":{"status":"NOT_CREATED","reference":None,"receipt":None}},
 "globalControls":{"securityTraceabilityGraph":None,"carriedForwardObligationLedger":None,"evidenceInvalidationMatrix":None,"sourceIntelligenceBundle":None},
 "bootstrapAgent":{"id":"web-bootstrap-agent","executorClass":"CHATGPT_WEB_CHAT_GITHUB_CONNECTOR","authority":"MECHANICAL_ONLY","phases":[0],
  "retirementRequires":["PHASE0_COMPLETION_VALIDATION_PASS","P0_TO_P1_HANDOFF_VALIDATION_PASS"]}}
out=Path(e["CONTROLLER_DIR"]); out.mkdir(parents=True,exist_ok=True)
for name,obj in [("CAMPAIGN_STATE_v1.json",state),("ACTIVE_PHASE_POINTER_v1.json",pointer),("SOLO_AUDIT_STATE_v1.json",solo)]:
    (out/name).write_text(json.dumps(obj,indent=2)+"\n")
active=Path(e["ACTIVE_PATH"]); active.parent.mkdir(parents=True,exist_ok=True); active.write_text(json.dumps(pointer,indent=2)+"\n")
