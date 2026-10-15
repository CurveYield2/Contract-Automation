import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

// Phase 0 may preserve a bounded, immutable fork dump for later proof-bound
// reuse. A missing/oversize state is never mistaken for a successful snapshot.
const LIMIT=24*1024*1024;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const PHASE0_FORK_STATE_MAX_BYTES_V1=LIMIT;
export async function capturePhase0ForkStateV1({
 rpc,outputDir,campaignId,sourceSha256,chainId,hardfork,finalBlock,
 maxBytes=LIMIT
}={}){
 if(typeof rpc!=='function'||!outputDir||!campaignId||
   !/^[a-f0-9]{64}$/.test(sourceSha256??'')||!Number.isInteger(chainId)||
   !Number.isInteger(finalBlock)||!hardfork)
   throw new Error('fork-state capture requires exact RPC/source/chain/block identity');
 const hex=await rpc('anvil_dumpState',[]);
 if(typeof hex!=='string'||!/^0x(?:[a-f0-9]{2})+$/i.test(hex))
   throw new Error('anvil_dumpState did not return byte-encoded state');
 const packed=Buffer.from(hex.slice(2),'hex');
 if(packed.length>maxBytes)
   return {schemaVersion:'curveyield-phase0-fork-state-v1',status:'TOO_LARGE',
     bytes:packed.length,maxBytes,sourceSha256,campaignId,chainId,hardfork,finalBlock};
 let state;
 try{state=gunzipSync(packed,{maxOutputLength:256*1024*1024});}
 catch(error){throw new Error('fork-state dump cannot be safely inflated: '+String(error?.message??error));}
 let parsed;
 try{parsed=JSON.parse(state.toString('utf8'));}
 catch{throw new Error('fork-state dump is not JSON state');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))
   throw new Error('fork-state dump has no object state');
 await fs.mkdir(outputDir,{recursive:true});
 const filename='PHASE0_FORK_STATE_v1.gz';
 await fs.writeFile(path.join(outputDir,filename),packed);
 const manifest={schemaVersion:'curveyield-phase0-fork-state-v1',
   status:'CAPTURED',format:'ANVIL_DUMP_GZIP_JSON_V1',
   campaignId,sourceSha256,chainId,hardfork,finalBlock,
   stateFile:filename,bytes:packed.length,sha256:sha256(packed)};
 await fs.writeFile(path.join(outputDir,'PHASE0_FORK_STATE_MANIFEST_v1.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
export async function verifyPhase0ForkStateV1({root,manifest}={}){
 if(manifest?.schemaVersion!=='curveyield-phase0-fork-state-v1'||
   manifest.status!=='CAPTURED'||manifest.format!=='ANVIL_DUMP_GZIP_JSON_V1'||
   manifest.stateFile!=='PHASE0_FORK_STATE_v1.gz'||
   !/^[0-9a-f]{64}$/.test(manifest.sha256??'')||manifest.bytes<1||manifest.bytes>LIMIT)
   throw new Error('untrusted Phase-0 fork-state manifest');
 const data=await fs.readFile(path.join(root,manifest.stateFile));
 if(data.length!==manifest.bytes||sha256(data)!==manifest.sha256)
   throw new Error('Phase-0 fork-state bytes or SHA-256 mismatch');
 const expanded=gunzipSync(data,{maxOutputLength:256*1024*1024});
 JSON.parse(expanded.toString('utf8'));
 return {status:'VERIFIED',sha256:manifest.sha256,bytes:data.length};
}
