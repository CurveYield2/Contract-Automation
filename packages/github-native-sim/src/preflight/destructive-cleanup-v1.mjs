import {check,finalize,requireSha40,requireText} from './common-v1.mjs';
export function preflightDestructiveCleanupV1(c={}){
 const x=[];
 x.push(requireSha40('cleanup.main',c.currentMainSha,{code:'CLEANUP_MAIN_SHA_INVALID',summary:'Current main SHA is unresolved',remediation:'Resolve current main immediately before cleanup.'}));
 x.push(check({id:'cleanup.compare',pass:c.compareCompleted===true,failureCode:'CLEANUP_COMPARE_NOT_COMPLETED',summary:'Target was not compared against current main',expected:true,observed:c.compareCompleted??null,remediation:'Compare unique commits/files before deletion/archive.'}));
 x.push(check({id:'cleanup.unique-content',pass:Array.isArray(c.uniqueFiles)&&Array.isArray(c.uniqueCommits),failureCode:'CLEANUP_UNIQUE_CONTENT_NOT_INSPECTED',summary:'Unique files/commits were not inventoried',expected:'uniqueFiles and uniqueCommits arrays',observed:{uniqueFiles:c.uniqueFiles??null,uniqueCommits:c.uniqueCommits??null},remediation:'Inventory every unique file/commit and classify preservation value.'}));
 const unpres=(c.uniqueValuableItems??[]).filter(i=>!(c.preservedItems??[]).includes(i));
 x.push(check({id:'cleanup.preserve',pass:unpres.length===0,failureCode:'CLEANUP_UNARCHIVED_UNIQUE_CONTENT',summary:'Cleanup would delete unique valuable implementation/evidence',expected:[],observed:unpres,remediation:'Preserve each valuable item in active path or CurveYield2/archive before deletion.'}));
 x.push(check({id:'cleanup.dependencies',pass:(c.openDependencies??[]).length===0,failureCode:'CLEANUP_OPEN_DEPENDENCY',summary:'Open PR/campaign/workflow still depends on cleanup target',expected:[],observed:c.openDependencies??null,remediation:'Close/rebind dependencies before deleting the target.'}));
 x.push(check({id:'cleanup.archive',pass:c.archiveRequired!==true||c.archiveVerified===true,failureCode:'CLEANUP_ARCHIVE_NOT_VERIFIED',summary:'Required archive destination/identity is not verified',expected:true,observed:c.archiveVerified??null,remediation:'Verify archived blob/digest before removing active copy.'}));
 x.push(check({id:'cleanup.active-references',pass:(c.activeReferencesAfterCleanup??[]).length===0,failureCode:'CLEANUP_ACTIVE_REFERENCE_WOULD_BREAK',summary:'Active references would point to the removed object',expected:[],observed:c.activeReferencesAfterCleanup??null,remediation:'Update/remove active references before cleanup.'}));
 x.push(requireText('cleanup.rollback',c.rollbackReference,{code:'CLEANUP_ROLLBACK_REFERENCE_MISSING',summary:'Rollback identity is missing',remediation:'Record prior commit/blob/branch identity before deletion.'}));
 return finalize('destructive-cleanup',c,x,{repository:c.repository,ref:c.currentMainSha,expectedOutputs:c.expectedOutputs,rollback:c.rollbackReference});
}
