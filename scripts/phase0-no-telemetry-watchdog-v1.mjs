#!/usr/bin/env node
// Separate-process Phase 0 No Telemetry watchdog. Intentionally outside the
// simulation process so stalled synchronous native commands cannot block it.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const NO_TELEMETRY_WATCHDOG_V1=Object.freeze({
  rpcProbeIntervalMs:30000,
  rpcProbeTimeoutMs:12000,
  consecutiveRpcFailures:3,
  medusaNoNewCallsMs:240000,
  generalNoProgressMs:600000,
  nativeScriptNoProgressMs:720000
});

export function noTelemetryStallReasonV1({
  now,lastProgressAt,phase,medusaLastAdvanceAt,medusaActive=false,
  rpcFailures=0
},policy=NO_TELEMETRY_WATCHDOG_V1){
  if(rpcFailures>=policy.consecutiveRpcFailures)return 'RPC_UNHEALTHY';
  if(medusaActive && now-medusaLastAdvanceAt>=policy.medusaNoNewCallsMs)return 'MEDUSA_CALLS_STALLED';
  const limit=phase==='native-deployment'?policy.nativeScriptNoProgressMs:policy.generalNoProgressMs;
  if(now-lastProgressAt>=limit)return 'SIMULATION_STAGE_STALLED';
  return null;
}

function log(message){process.stderr.write('[phase0-no-telemetry-watchdog] '+message+'\n');}
function rpcUrl(){return process.env.ETHEREUM_FORK_RPC_URL??'';}
async function checkRpc(url){
  const response=await fetch(url,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}),
    signal:AbortSignal.timeout(NO_TELEMETRY_WATCHDOG_V1.rpcProbeTimeoutMs)
  });
  if(!response.ok)throw new Error('HTTP_'+response.status);
  const data=await response.json();
  if(data.error||!/^0x[0-9a-f]+$/i.test(String(data.result??'')))throw new Error('INVALID_RPC_RESPONSE');
}

export async function superviseNoTelemetryV1(args=process.argv.slice(2)){
  const marker=args.indexOf('--');
  const command=args[marker+1];
  const cliArgs=args.slice(marker+2);
  if(marker<0||command!=='node'||cliArgs[0]!=='scripts/run-phase0-randomized-simulation-no-telemetry-v1.mjs'){
    throw new Error('watchdog must execute the canonical Phase 0 No Telemetry runner');
  }
  if(!rpcUrl())throw new Error('RPC_ETHEREUM upstream secret missing');
  const child=spawn(process.execPath,cliArgs,{cwd:process.cwd(),env:process.env,stdio:['ignore','pipe','pipe'],detached:true});
  const startedAt=Date.now();
  let phase='setup',lastProgressAt=startedAt,medusaLastAdvanceAt=startedAt;
  let medusaActive=false,medusaCalls=0,rpcFailures=0,networkFree=false;
  let finished=false,fatalCode=0,terminating=false,probeBusy=false;
  function terminate(reason,code=78){
    if(terminating||finished)return;
    terminating=true;fatalCode=code;
    log('FAIL reason='+reason+' stage='+phase+' elapsed_seconds='+Math.floor((Date.now()-startedAt)/1000)+' medusa_calls_in_shard='+medusaCalls);
    // Detached process group ensures forked Anvil/Forge/Medusa children are
    // terminated together rather than left running on the GitHub runner.
    try{process.kill(-child.pid,'SIGTERM');}catch{try{child.kill('SIGTERM');}catch{}}
    const escalation=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},5000);
    escalation.unref?.();
  }
  function parseLine(line){
    if(/\[phase0-smoke-progress\]/.test(line)&&/\b(START|END)\b/.test(line)){
      phase=/native deployment scripts/.test(line)?'native-deployment':'simulation';
      lastProgressAt=Date.now();
    }
    if(/\[phase0-deployment\] native script started/.test(line)){
      phase='native-deployment';lastProgressAt=Date.now();
    }
    if(/\[phase0-deployment\] native script exited/.test(line)){
      phase='simulation';lastProgressAt=Date.now();
    }
    if(/\[phase0-medusa\] state source:/.test(line)){
      networkFree=/"mode":"NETWORK_FREE_POST_DEPLOYMENT_STATE_SNAPSHOT"/.test(line);
      phase='medusa';lastProgressAt=Date.now();
    }
    if(/\[phase0-medusa\] shard \d+:/.test(line)){
      phase='medusa';medusaActive=true;medusaCalls=0;
      medusaLastAdvanceAt=Date.now();lastProgressAt=Date.now();
    }
    const calls=line.match(/\[phase0-medusa\] heartbeat:.*?\bcalls=(\d+)/);
    if(calls){
      const next=Number(calls[1]);
      if(next>medusaCalls){
        medusaCalls=next;medusaLastAdvanceAt=Date.now();lastProgressAt=Date.now();
      }
    }
    if(/\[phase0-medusa\] shard \d+ done:/.test(line)){
      medusaActive=false;phase='medusa-between-shards';lastProgressAt=Date.now();
    }
    if(/\[phase0-deps\] pinned npm install PASS/.test(line))lastProgressAt=Date.now();
    if(/\[phase0-no-telemetry-watchdog\]/.test(line))return;
  }
  for(const [stream,dest] of [[child.stdout,process.stdout],[child.stderr,process.stderr]]){
    let pending='';
    stream.on('data',buffer=>{
      dest.write(buffer);
      pending+=buffer.toString('utf8');
      const lines=pending.split('\n');pending=lines.pop()??'';
      // Parser buffers are bounded, never store potentially enormous telemetry.
      if(pending.length>16384)pending=pending.slice(-4096);
      for(const line of lines)parseLine(line);
    });
  }
  const timer=setInterval(async()=>{
    if(finished||terminating||probeBusy)return;
    const now=Date.now();
    const blocked=noTelemetryStallReasonV1({
      now,lastProgressAt,phase,medusaLastAdvanceAt,medusaActive,rpcFailures
    });
    if(blocked){terminate(blocked);return;}
    // The Medusa snapshot is network-free; do not mistake an irrelevant
    // upstream outage for a blocked fuzzing run.
    if(networkFree)return;
    probeBusy=true;
    try{
      await checkRpc(rpcUrl());
      if(rpcFailures)log('upstream RPC recovered after '+rpcFailures+' failed probes');
      rpcFailures=0;
    }catch(error){
      rpcFailures++;
      log('RPC probe failure '+rpcFailures+'/'+NO_TELEMETRY_WATCHDOG_V1.consecutiveRpcFailures+' ('+String(error?.message??'UNAVAILABLE').slice(0,100)+')');
      if(rpcFailures>=NO_TELEMETRY_WATCHDOG_V1.consecutiveRpcFailures)terminate('RPC_UNHEALTHY');
    }finally{probeBusy=false;}
  },NO_TELEMETRY_WATCHDOG_V1.rpcProbeIntervalMs);
  const stop=signal=>terminate('SUPERVISOR_'+signal,124);
  process.on('SIGTERM',()=>stop('SIGTERM'));
  process.on('SIGINT',()=>stop('SIGINT'));
  log('started; upstream RPC checked every 30s while needed; 3 consecutive failures fail; Medusa no-call stall=240s; native script silence=720s');
  try{
    const result=await new Promise((resolve,reject)=>{
      child.once('error',reject);
      child.once('close',(code,signal)=>resolve({code,signal}));
    });
    finished=true;
    if(fatalCode)return fatalCode;
    if(result.code!==0)log('child failed with code='+String(result.code)+' signal='+String(result.signal));
    return result.code??1;
  }finally{finished=true;clearInterval(timer);}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  superviseNoTelemetryV1().then(code=>{process.exitCode=code;}).catch(error=>{
    log('FAIL reason=SUPERVISOR_ERROR detail='+String(error?.message??error).slice(0,200));
    process.exitCode=78;
  });
}
