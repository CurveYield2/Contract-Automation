import {check,finalize,requireSha64,equalityCheck} from './common-v1.mjs';
export function preflightSlitherV1(c={}){
 const x=[];
 x.push(requireSha64('slither.build-digest',c.acceptedBuildDigest,{code:'SLITHER_BUILD_DIGEST_MISSING',summary:'Accepted build digest is missing',remediation:'Run/accept the exact compile result before Slither.'}));
 x.push(check({id:'slither.build-status',pass:c.acceptedBuildStatus==='PASS',failureCode:'SLITHER_BUILD_NOT_ACCEPTED',summary:'Slither is being started without an accepted build',expected:'PASS',observed:c.acceptedBuildStatus??null,remediation:'Repair compile/build first; Slither must consume accepted build state.'}));
 x.push(equalityCheck('slither.version','0.11.6',c.observedVersion,{code:'SLITHER_VERSION_MISMATCH',summary:'Slither version is not canonical',remediation:'Use pinned slither-analyzer 0.11.6 from setup-v7-toolchain.'}));
 x.push(check({id:'slither.solidity-targets',pass:Number.isInteger(c.soliditySourceCount)&&c.soliditySourceCount>0,failureCode:'SLITHER_NO_SOLIDITY_TARGETS',summary:'No Solidity sources are available for Slither',expected:'>0',observed:c.soliditySourceCount??null,remediation:'Do not run Slither for a target with no compatible Solidity source; record limitation/applicability.'}));
 x.push(check({id:'slither.build-view',pass:c.buildViewCompatible===true,failureCode:'SLITHER_BUILD_VIEW_INCOMPATIBLE',summary:'Static-analysis project/build view is not compatible with Slither',expected:true,observed:c.buildViewCompatible??null,remediation:'Use the accepted build/analysis view and explicit mixed-language exclusions where required.'}));
 x.push(check({id:'slither.output-contract',pass:c.normalizedResultAuthoritative===false,failureCode:'SLITHER_RESULT_AUTHORITY_INVALID',summary:'Slither normalized output is incorrectly marked authoritative security judgment',expected:false,observed:c.normalizedResultAuthoritative??null,remediation:'Keep static-analysis output neutral/non-authoritative; human audit determines findings.'}));
 return finalize('slither',c,x,{repository:c.repository,ref:c.ref,expectedOutputs:c.expectedOutputs,rollback:'none'});
}
