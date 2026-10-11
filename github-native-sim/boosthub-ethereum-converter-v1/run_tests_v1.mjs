// No mutable calls are ever sent to an upstream RPC. Both nodes are spawned locally.
import fs from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
const pin=26167322;fs.mkdirSync('test_evidence_v1',{recursive:true});
const children=[];
try {
 for(const [port,args] of [[8545,['--fork-url','https://eth.drpc.org','--fork-block-number',String(pin)]],[8546,[]]]){
  const log=fs.openSync('test_evidence_v1/anvil_'+port+'_v1.log','w');children.push(spawn('anvil',['--host','127.0.0.1','--port',String(port),'--chain-id','1',...args],{stdio:['ignore',log,log]}));
 }
 for(const port of [8545,8546]){let ready=false;for(let attempt=0;attempt<40;attempt++){try{const r=await fetch('http://127.0.0.1:'+port,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'web3_clientVersion',params:[]})});const j=await r.json();if(/anvil/i.test(j.result)){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Local Anvil did not start');}
 for(const [label,args] of [['unit',['--test','unit_v1.test.mjs']],['fork',['fork_v1.mjs']]]){const r=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:8*1024*1024});fs.writeFileSync('test_evidence_v1/'+label+'_v1.txt',r.stdout+r.stderr);process.stdout.write(r.stdout);process.stderr.write(r.stderr);if(r.status!==0)throw Error(label+' tests failed');}
} finally {for(const c of children)c.kill('SIGTERM');}
