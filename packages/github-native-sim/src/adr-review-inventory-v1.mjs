import fs from 'node:fs/promises';
import path from 'node:path';
import {listAdmittedSourcesV1} from './source-intelligence-technical-v1.mjs';
import {digestCanonicalV1} from './canonical-json-v1.mjs';
import {buildSystemFactsV1} from './adr-system-facts-v1.mjs';
import {loadTaxonomyV1} from './adr-taxonomy-v1.mjs';

const POLICY='audit-detection-rebuild-v1';
const REVIEW_KINDS=new Set(['FUNCTION','CONSTRUCTOR','FALLBACK','RECEIVE','FREE_FUNCTION','MODIFIER','STATE_INITIALIZER','CONSTANT','IMMUTABLE','GENERATED_GETTER']);
const GUARD=/only|auth|restricted|whenNot|whenPaused|initializer|nonReentrant/i;
const ROLE=/owner|admin|role|controller|guardian|authority|operator|keeper/i;
const TOKEN=/^(transfer|transferFrom|safeTransfer|safeTransferFrom)$/;
const APPROVE=/^(approve|safeApprove|forceApprove|increaseAllowance|decreaseAllowance|safeIncreaseAllowance|permit)$/;
const SORT=(a,b)=>String(a).localeCompare(String(b));
const distinct=(values)=>[...new Set(values.filter(x=>x!==undefined&&x!==null))].sort(SORT);
const byPosition=(a,b)=>a.path.localeCompare(b.path)||a.lineStart-b.lineStart||a.contextId.localeCompare(b.contextId);
const nodeStart=(n)=>Number(String(n?.src??'0:0').split(':')[0])||0;
const children=(n)=>Object.entries(n??{}).filter(([key,value])=>!['scope','referencedDeclaration','linearizedBaseContracts'].includes(key)&&value&&typeof value==='object').flatMap(([,value])=>Array.isArray(value)?value:[value]);
function walk(n,fn,parent=null) {
  if(!n||typeof n!=='object')return;
  if(Array.isArray(n)){for(const v of n)walk(v,fn,parent);return;}
  if(n.nodeType)fn(n,parent);
  for(const item of children(n))walk(item,fn,n);
}
function sourceTier(p) {
  if(/(^|\/)(test|tests|mock|mocks)\//.test(p)||p.endsWith('.t.sol'))return 'TEST_OR_MOCK';
  if(/^(vendor|lib|node_modules|@)\//.test(p)||p.startsWith('@'))return 'DEPENDENCY';
  return 'IN_SCOPE';
}
function lines(bytes,src) {
  const [start,length]=String(src??'0:0').split(':').map(Number);
  const a=Math.min(Math.max(0,start||0),bytes.length),b=Math.min(Math.max(0,(start||0)+(length||0)),bytes.length);
  const count=(end)=>{let n=1;for(let i=0;i<end;i++)if(bytes[i]===10)n++;return n;};
  return {lineStart:count(a),lineEnd:count(b)};
}
function sourceText(bytes,src) {
  const [start,len]=String(src??'0:0').split(':').map(Number);
  return bytes.subarray(start||0,(start||0)+(len||0)).toString('utf8');
}
function sig(node,name) {
  const pars=node.parameters?.parameters??[];
  return name+'('+pars.map(p=>String(p.typeDescriptions?.typeString??p.typeName?.name??'unknown').replace(/\b(storage|memory|calldata)\b/g,'').replace(/\s+/g,'')).join(',')+')';
}
function kindOf(node,outside) {
  if(node.nodeType==='FunctionDefinition')return outside?'FREE_FUNCTION':({function:'FUNCTION',constructor:'CONSTRUCTOR',fallback:'FALLBACK',receive:'RECEIVE'}[node.kind]??'FUNCTION');
  if(node.nodeType==='ModifierDefinition')return 'MODIFIER';
  if(node.nodeType==='VariableDeclaration'&&node.stateVariable)return node.constant?'CONSTANT':node.mutability==='immutable'?'IMMUTABLE':'STATE_VARIABLE';
  return null;
}
function emptyArtifact(campaign,payload,schemaVersion='curveyield-review-inventory-v1') {
  return {schemaVersion,campaignId:campaign.campaignId??'',campaignGenerationId:campaign.campaignGenerationId??'',
    sourceSha256:campaign.sourceSha256??campaign.archiveSha256??'',taxonomyVersion:'curveyield-defect-taxonomy-v1',
    detectionPolicy:POLICY,generatedAt:campaign.generatedAt??'1970-01-01T00:00:00.000Z',payload};
}
const blankPayload=()=>({sourceUnits:[],declarations:[],contexts:[],triggers:{},limitations:[],complete:false,counts:{sourceUnits:0,inScopeUnits:0,declarations:0,contexts:0,byKind:{}}});

export async function buildReviewInventoryV1({projectRoot,build,campaign}) {
  if(!projectRoot||!build||!campaign)throw new TypeError('projectRoot, build, campaign required');
  const sources=await listAdmittedSourcesV1(projectRoot), bySource=new Map();
  for(const s of sources) {
    const bytes=await fs.readFile(path.join(projectRoot,...s.path.split('/')));
    bySource.set(s.path,{...s,bytes,tier:sourceTier(s.path)});
  }
  const asts=new Map();
  const units=(build.compilationUnits??[]).filter(u=>u.sourceAsts&&Object.keys(u.sourceAsts).length);
  for(const unit of (units.length?units:[{sourceAsts:build.sourceAsts??{}}]))
    for(const [name,ast] of Object.entries(unit.sourceAsts??{}).sort(([a],[b])=>a.localeCompare(b)))
      if(bySource.has(name)&&!asts.has(name))asts.set(name,ast);

  const sourceUnits=sources.map(s=>({sourceId:s.sourceId,path:s.path,sha256:s.sha256,scopeTier:bySource.get(s.path).tier,
    astStatus:s.path.endsWith('.vy')?'UNSUPPORTED_LANGUAGE':asts.has(s.path)?'AVAILABLE':'MISSING'}));
  const limitations=[{code:'DEPENDENCY_TIER_BY_PATH',path:'*',detail:'Dependency tier assigned by path prefix; modified vendored code must be moved out of vendor/ to be reviewed as in-scope.'}];
  const declarations=[],contexts=[],triggers={},nodeById=new Map(),contractById=new Map(),metadata=new Map(),contextBySymbol=new Map(),usedIds=new Map();
  for(const [file,ast] of asts) {
    const source=bySource.get(file);
    let current=null;
    // First pass registers every contract and declaration. References are resolved only after all files are indexed.
    function descend(node,contract=null) {
      if(!node||typeof node!=='object')return;
      if(Array.isArray(node)){for(const entry of node)descend(entry,contract);return;}
      if(node.nodeType==='ContractDefinition') {
        contract={id:node.id,path:file,qualified:file+':'+node.name,node,tier:source.tier,
          directBases:(node.baseContracts??[]).map(b=>b.baseName?.namePath??b.baseName?.name??'').filter(Boolean),
          implementedInterfaces:[],containerKind:node.contractKind??'contract',abstract:!!node.abstract};
        contractById.set(node.id,contract);
      }
      if(Number.isInteger(node.id))nodeById.set(node.id,{node,path:file,contract});
      if(node.nodeType==='FunctionDefinition'||node.nodeType==='ModifierDefinition'||(node.nodeType==='VariableDeclaration'&&node.stateVariable)) {
        const type=kindOf(node,!contract);
        if(type) {
          const name=node.kind==='constructor'?'constructor':node.kind==='fallback'?'fallback':node.kind==='receive'?'receive':node.name??'';
          const qualifiedContainer=contract?.qualified??file;
          const base={path:file,qualifiedContainer,containerKind:contract?.containerKind??'file',kind:type,name,
            canonicalSignature:node.nodeType==='VariableDeclaration'?name: sig(node,name),visibility:node.visibility??'internal',
            stateMutability:node.stateMutability??'nonpayable',...lines(source.bytes,node.src),hasBody:!!node.body,
            ...(contract?.abstract?{abstract:true}:{})};
          const kinds=[base];
          if(node.nodeType==='VariableDeclaration') {
            if(node.visibility==='public')kinds.push({...base,kind:'GENERATED_GETTER',canonicalSignature:name+'()',
              visibility:'public',hasBody:true});
            if(node.value&&!node.constant)kinds.push({...base,kind:'STATE_INITIALIZER',canonicalSignature:name+'<initializer>()',hasBody:true});
          }
          for(const declaration of kinds) {
            const identity={path:file,qualifiedContainer,kind:declaration.kind,canonicalSignature:declaration.canonicalSignature};
            const core=digestCanonicalV1(identity).slice(0,16),num=(usedIds.get(core)??0)+1;usedIds.set(core,num);
            const suffix=num===1?'':'-'+num, symbolId='SYM-'+core+suffix;
            const d={symbolId,...declaration};
            declarations.push(d);
            metadata.set(symbolId,{node,path:file,contract,tier:source.tier});
            if(declaration.kind===type&&Number.isInteger(node.id))nodeById.set(node.id,{node,path:file,contract,symbolId});
            if(source.tier==='IN_SCOPE'&&REVIEW_KINDS.has(declaration.kind)&&(declaration.kind!=='FUNCTION'||!!node.body)&&
              (contract?.containerKind!=='interface'||!!node.body)) {
              const c={contextId:'CTX-'+core+suffix,symbolId,path:file,qualifiedContainer,kind:d.kind,
                canonicalSignature:d.canonicalSignature,visibility:d.visibility,stateMutability:d.stateMutability,
                lineStart:d.lineStart,lineEnd:d.lineEnd,effectiveIn:[],scopeTier:'IN_SCOPE',
                dependencySymbolIds:[],stateReads:[],stateWrites:[],internalCalls:[],modifiers:[],externalCalls:[]};
              contexts.push(c);contextBySymbol.set(symbolId,c);
            }
          }
        }
      }
      // Top-level declaration search only. Do not regard local variable declarations as state declarations.
      if(node.nodeType==='SourceUnit'||node.nodeType==='ContractDefinition') for(const ch of node.nodes??[])descend(ch,contract);
    }
    descend(ast);
  }
  const byId=new Map(contexts.map(c=>[c.contextId,c]));
  const contractInfo=[...contractById.values()];
  for(const c of contractInfo) {
    c.baseIds=(c.node.linearizedBaseContracts??[]).filter(id=>id!==c.id);
    c.implementedInterfaces=c.baseIds.map(id=>contractById.get(id)).filter(b=>b?.containerKind==='interface').map(x=>x.qualified);
  }
  for(const c of contractInfo.filter(c=>c.tier==='IN_SCOPE'&&c.containerKind==='contract'&&!c.abstract)) {
    const bases=(c.node.linearizedBaseContracts??[c.id]).map(id=>contractById.get(id)).filter(Boolean);
    const seen=new Set();
    for(const b of bases) {
      for(const d of declarations.filter(d=>d.qualifiedContainer===b.qualified&&['FUNCTION','FALLBACK','RECEIVE','GENERATED_GETTER','MODIFIER'].includes(d.kind))) {
        if(seen.has(d.canonicalSignature))continue;
        seen.add(d.canonicalSignature);
        let ctx=contextBySymbol.get(d.symbolId);
        if(!ctx&&b.tier==='DEPENDENCY'&&['FUNCTION','GENERATED_GETTER'].includes(d.kind)&&
          ['public','external'].includes(d.visibility)&&d.hasBody) {
          ctx={contextId:d.symbolId.replace(/^SYM-/,'CTX-'),symbolId:d.symbolId,
            path:d.path,qualifiedContainer:d.qualifiedContainer,kind:'INHERITED_DEPENDENCY',
            canonicalSignature:d.canonicalSignature,visibility:d.visibility,stateMutability:d.stateMutability,
            lineStart:d.lineStart,lineEnd:d.lineEnd,effectiveIn:[],scopeTier:'INHERITED_DEPENDENCY',
            dependencySymbolIds:[],stateReads:[],stateWrites:[],internalCalls:[],modifiers:[],externalCalls:[]};
          contexts.push(ctx);contextBySymbol.set(d.symbolId,ctx);byId.set(ctx.contextId,ctx);
        }
        if(ctx)ctx.effectiveIn.push(c.qualified);
      }
    }
    for(const d of declarations.filter(d=>d.qualifiedContainer===c.qualified&&d.kind==='CONSTRUCTOR')) {
      const ctx=contextBySymbol.get(d.symbolId);if(ctx)ctx.effectiveIn.push(c.qualified);
    }
  }
  for(const ctx of contexts) {
    const meta=metadata.get(ctx.symbolId);
    if(meta?.contract?.containerKind==='library')ctx.effectiveIn.push(meta.contract.qualified);
    ctx.effectiveIn=distinct(ctx.effectiveIn);
    if(!ctx.effectiveIn.length)ctx.orphan=true;
  }
  // Temporary context analysis structures are never serialized into inventory JSON.
  const temp=new Map();
  for(const ctx of contexts) {
    const meta=metadata.get(ctx.symbolId),source=bySource.get(ctx.path),n=meta?.node;
    const examined=ctx.kind==='STATE_INITIALIZER'?n?.value:ctx.kind==='GENERATED_GETTER'?null:n;
    const nodes=[],calls=[],writes=[],reads=[],members=[],external=[],modifiers=[];
    walk(examined,(v,parent)=>{nodes.push({v,parent});
      if(v.nodeType==='ModifierInvocation')modifiers.push(v.modifierName?.name??v.modifierName?.namePath??'');
      if(v.nodeType==='FunctionCall')calls.push({v,parent});
      if(v.nodeType==='MemberAccess')members.push({v,parent});
      if(v.nodeType==='Identifier'&&Number.isInteger(v.referencedDeclaration)){
        const ref=nodeById.get(v.referencedDeclaration);
        if(ref?.node?.stateVariable)reads.push({v,name:ref.node.name,node:ref.node,parent});
      }
    });
    const writeIds=new Set();
    function markTarget(root) {
      walk(root,v=>{if(v.nodeType==='Identifier'&&Number.isInteger(v.referencedDeclaration)&&nodeById.get(v.referencedDeclaration)?.node?.stateVariable)
        writeIds.add(nodeById.get(v.referencedDeclaration).node.name);
      });
    }
    for(const {v} of nodes) {
      if(v.nodeType==='Assignment')markTarget(v.leftHandSide);
      if(v.nodeType==='UnaryOperation'&&['++','--','delete'].includes(v.operator))markTarget(v.subExpression);
      if(v.nodeType==='FunctionCall'&&['push','pop'].includes(v.expression?.memberName))markTarget(v.expression?.expression);
    }
    for(const r of reads)if(writeIds.has(r.name))writes.push(r);
    ctx.stateReads=distinct(reads.map(r=>r.name));
    ctx.stateWrites=distinct([...writeIds]);
    ctx.modifiers=distinct(modifiers);
    for(const {v,parent} of calls) {
      const exp=v.expression,member=exp?.memberName??'',id=exp?.referencedDeclaration;
      const ref=nodeById.get(id);
      if(ref?.node?.nodeType==='FunctionDefinition'&&ref.symbolId)ctx.internalCalls.push(ref.symbolId);
      if(exp?.nodeType==='Identifier'&&exp.referencedDeclaration&&nodeById.get(exp.referencedDeclaration)?.node?.nodeType==='FunctionDefinition'){
        const link=nodeById.get(exp.referencedDeclaration).symbolId;if(link)ctx.internalCalls.push(link);
      }
      if(exp?.nodeType==='MemberAccess') {
        const type=exp.expression?.typeDescriptions?.typeString??'';
        if(/^(contract |address\b)/.test(type)&&!['balance','code','codehash'].includes(member))
          external.push({memberName:member,targetType:type,line:lines(source.bytes,v.src).lineStart,start:nodeStart(v),
            base:exp.expression,call:v,parent});
      }
    }
    ctx.internalCalls=distinct(ctx.internalCalls);
    ctx.externalCalls=external.map(({memberName,targetType,line})=>({memberName,targetType,line}))
      .sort((a,b)=>a.line-b.line||a.memberName.localeCompare(b.memberName)||a.targetType.localeCompare(b.targetType));
    temp.set(ctx.contextId,{nodes,calls,writes,reads,members,external,source,meta});
  }
  const lookup=new Map(contexts.map(x=>[x.symbolId,x]));
  for(const ctx of contexts) {
    const t=temp.get(ctx.contextId),n=t?.meta?.node,text=n?sourceText(t.source.bytes,n.src):'';
    const rules=new Set(),has=(re)=>re.test(text),nodes=t?.nodes.map(x=>x.v)??[],calls=t?.calls??[],members=t?.members.map(x=>x.v)??[];
    const callNames=calls.map(x=>x.v.expression?.memberName??x.v.expression?.name??'');
    const hasCall=(regex)=>callNames.some(x=>regex.test(x));
    const hasMember=(object,prop)=>members.some(m=>m.memberName===prop&&m.expression?.name===object);
    const params=n?.parameters?.parameters??[];
    if(ctx.stateWrites.length)rules.add('STATE_WRITE');
    if(ctx.modifiers.some(x=>GUARD.test(x))||hasCall(/^(hasRole|_checkRole|canPerform|_authenticateCaller|getActionId|_checkOwner)$/)||
      /(?:require|if)\s*\([^;]*msg\.sender/.test(text))rules.add('PRIVILEGED_GUARD');
    if(hasMember('tx','origin'))rules.add('TX_ORIGIN');
    if(ctx.stateMutability==='payable'||hasMember('msg','value'))rules.add('PAYABLE');
    if(ctx.stateWrites.some(x=>ROLE.test(x))||hasCall(/^(grantRole|revokeRole|_grantRole|_revokeRole|_transferOwnership|transferOwnership)$/))rules.add('OWNERSHIP_OR_ROLE_WRITE');
    if([...ctx.stateReads,...ctx.stateWrites].some(x=>/^pending/i.test(x)))rules.add('PENDING_STATE');
    if(ctx.modifiers.some(x=>/^(initializer|reinitializer|onlyInitializing)$/.test(x))||/^initialize/i.test(n?.name??''))rules.add('INITIALIZER');
    if(nodes.some(x=>x.nodeType==='BinaryOperation'&&/^(?:\+|-|\*|\/|%|\*\*)$/.test(x.operator))&&
      (ctx.stateReads.length||ctx.stateWrites.length))rules.add('ARITHMETIC_ON_STATE');
    if(nodes.some(x=>x.nodeType==='BinaryOperation'&&x.operator==='/')||hasCall(/^(mulDiv|mulDivDown|mulDivUp|divUp|divDown|divWadDown|divWadUp)$/))rules.add('DIVISION');
    if(nodes.some(x=>x.nodeType==='Literal'&&/^(10000|1000|1e4|1e6|1e18|1e27)$/i.test(String(x.value)))||
      has(/\b(BPS|BASIS|WAD|RAY|SCALE|PRECISION|DENOMINATOR)\b/i))rules.add('BPS_OR_SCALE_CONSTANT');
    if(ctx.stateWrites.some(x=>/executed|cancel|approved|claimed|status|state|active|paused|used/i.test(x)))rules.add('STATUS_FLAG_WRITE');
    if(ctx.stateWrites.length&&nodes.some(x=>x.nodeType==='IndexAccess'||x.nodeType==='MemberAccess'))rules.add('MAPPING_STRUCT_WRITE');
    if(t.external.length)rules.add('EXTERNAL_CALL');
    if(members.some(x=>/^(call|delegatecall|staticcall|send|transfer)$/.test(x.memberName)&&
      /^address\b/.test(x.expression?.typeDescriptions?.typeString??'')))rules.add('LOW_LEVEL_CALL');
    if(members.some(x=>x.memberName==='delegatecall'))rules.add('DELEGATECALL');
    if(t.external.some(x=>x.parent?.nodeType==='Assignment'||x.parent?.nodeType==='Return'||x.parent?.nodeType==='IfStatement'||
      x.parent?.nodeType==='VariableDeclarationStatement'))rules.add('RETURN_VALUE_USED');
    if(t.external.length&&t.writes.length&&t.external.some(x=>t.writes.some(y=>nodeStart(x.call)<nodeStart(y.v))))rules.add('EXTERNAL_CALL_BEFORE_STATE_WRITE');
    if(t.external.some(x=>params.some(p=>sourceText(t.source.bytes,x.base?.src??'').includes(p.name)&&p.name)))rules.add('ARBITRARY_TARGET_CALL');
    if(hasCall(TOKEN))rules.add('TOKEN_TRANSFER');
    if(hasCall(/^balanceOf$/))rules.add('TOKEN_BALANCE_READ');
    if(hasCall(APPROVE))rules.add('APPROVE_OR_PERMIT');
    if(hasCall(/^(latestRoundData|latestAnswer|getPrice|getRate|consult|observe|getQuote|twap|quote)$/))rules.add('ORACLE_READ');
    if(hasCall(/^(getReserves|slot0|getCurrentLiveBalances|getPoolTokenInfo|getPoolTokens)$/))rules.add('SPOT_PRICE_READ');
    if(/^swap|exactInput|exactOutput|exchange|trade/i.test(n?.name??'')||hasCall(/^(swap|exactInput|exactOutput|exchange|trade)/i))rules.add('SWAP_OR_TRADE');
    if(params.some(p=>/min(Amount)?Out|minReturn|amountOutMin|limit/i.test(p.name)))rules.add('MIN_OUT_PARAM');
    if(params.some(p=>/deadline/i.test(p.name)))rules.add('DEADLINE_PARAM');
    if(hasCall(/^(ecrecover|recover|tryRecover|isValidSignatureNow|isValidSignature)$/))rules.add('SIGNATURE_VERIFY');
    if([...ctx.stateReads,...ctx.stateWrites].some(x=>/nonce/i.test(x)))rules.add('NONCE_USE');
    if(has(/DOMAIN_SEPARATOR|_hashTypedDataV4|EIP712/))rules.add('EIP712');
    if(has(/keccak256\s*\(\s*abi\.encode(Packed)?\s*\(/))rules.add('KEY_DERIVATION');
    if(params.filter(p=>/tokenIn|tokenOut|tokenA|tokenB|from|to|base|quote/i.test(p.name)&&
      /address/.test(p.typeDescriptions?.typeString??'')).length>=2)rules.add('ORDER_SENSITIVE_PAIR');
    if(t.meta?.contract?.directBases.some(x=>/Upgradeable|Initializable|UUPS|ERC1967|Proxy/.test(x)))rules.add('PROXY_PATTERN');
    if([...ctx.stateReads,...ctx.stateWrites].includes('__gap'))rules.add('STORAGE_GAP');
    if(nodes.some(x=>['ForStatement','WhileStatement'].includes(x.nodeType)&&/\.\s*length/.test(sourceText(t.source.bytes,x.condition?.src??''))))rules.add('LOOP_OVER_DYNAMIC');
    if(t.external.some(x=>nodes.some(v=>['ForStatement','WhileStatement'].includes(v.nodeType)&&nodeStart(x.call)>=nodeStart(v)&&
      nodeStart(x.call)<=nodeStart(v)+Number(String(v.src).split(':')[1]))))rules.add('EXTERNAL_CALL_IN_LOOP');
    if(hasCall(/^push$/)&&ctx.stateWrites.length)rules.add('PUSH_TO_UNBOUNDED_ARRAY');
    if(hasCall(TOKEN)&&!has(/transfer(?:From)?\s*\(\s*msg\.sender/))rules.add('VALUE_FLOW_CROSS_USER');
    if(/^(?:_mint|_burn|mint|burn)$/.test(n?.name??'')||hasCall(/^(?:_mint|_burn|mint|burn)$/)||ctx.stateWrites.includes('totalSupply'))rules.add('SHARE_MINT_BURN');
    if(has(/fee|bps|split|distribut|reward/i)&&nodes.some(x=>x.nodeType==='BinaryOperation'))rules.add('FEE_DISTRIBUTION');
    if(hasMember('block','timestamp'))rules.add('BLOCK_TIMESTAMP');
    if(hasMember('block','number'))rules.add('BLOCK_NUMBER');
    if(has(/lzReceive|ccipReceive|_nonblockingLzReceive|receiveWormhole|messenger|bridge/i))rules.add('CROSS_CHAIN_MESSAGE');
    if(ctx.kind==='CONSTANT'||ctx.kind==='IMMUTABLE')rules.add('CONSTANT');
    if((ctx.kind==='CONSTRUCTOR'||rules.has('INITIALIZER'))&&params.length&&ctx.stateWrites.length)rules.add('CONSTRUCTOR_OR_INITIALIZER_PARAM');
    triggers[ctx.contextId]=rules;
  }
  // A reachable callee contributes writes/external calls to its public/external entry and vice versa.
  const reverse=new Map();
  for(const c of contexts)for(const id of c.internalCalls) {
    const parent=lookup.get(id);if(!parent)continue;
    const arr=reverse.get(parent.contextId)??[];arr.push(c.contextId);reverse.set(parent.contextId,arr);
  }
  for(const c of contexts) {
    const seen=new Set([c.contextId]),queue=[[c.contextId,0]];
    while(queue.length) {
      const [id,depth]=queue.shift();if(depth>=3)continue;
      for(const linked of lookup.get(byId.get(id)?.symbolId)?.internalCalls??[]) {
        const to=lookup.get(linked);if(to&&!seen.has(to.contextId)){seen.add(to.contextId);queue.push([to.contextId,depth+1]);}
      }
    }
    c.dependencySymbolIds=distinct([...seen].filter(x=>x!==c.contextId).map(x=>byId.get(x)?.symbolId));
    if(['public','external'].includes(c.visibility)&&[...seen].some(id=>triggers[id]?.has('STATE_WRITE')||triggers[id]?.has('EXTERNAL_CALL')))triggers[c.contextId].add('STATE_WRITE_EXTERNAL');
    for(const parentId of reverse.get(c.contextId)??[]) {
      const parent=byId.get(parentId);
      if(parent&&['public','external'].includes(parent.visibility)&&[...seen].some(id=>triggers[id]?.has('STATE_WRITE')||triggers[id]?.has('EXTERNAL_CALL')))
        triggers[c.contextId].add('STATE_WRITE_EXTERNAL');
    }
    if(triggers[c.contextId].has('PUSH_TO_UNBOUNDED_ARRAY')&&!triggers[c.contextId].has('STATE_WRITE_EXTERNAL'))
      triggers[c.contextId].delete('PUSH_TO_UNBOUNDED_ARRAY');
  }
  let complete=true;
  for(const s of sourceUnits) {
    if(s.astStatus==='AVAILABLE'||s.scopeTier!=='IN_SCOPE'&&s.astStatus!=='UNSUPPORTED_LANGUAGE')continue;
    if(s.astStatus==='MISSING'&&s.scopeTier==='IN_SCOPE')complete=false;
    const source=bySource.get(s.path),n=source.bytes;
    const symbolId='SYM-'+digestCanonicalV1({path:s.path,qualifiedContainer:s.path,kind:'FILE_FALLBACK',canonicalSignature:'file()'}).slice(0,16);
    const ctx={contextId:symbolId.replace(/^SYM-/,'CTX-'),symbolId,path:s.path,qualifiedContainer:s.path,kind:'FILE_FALLBACK',
      canonicalSignature:'file()',visibility:'internal',lineStart:1,lineEnd:lines(n,'0:'+n.length).lineEnd,effectiveIn:[],
      scopeTier:s.scopeTier,dependencySymbolIds:[],stateReads:[],stateWrites:[],internalCalls:[],modifiers:[],externalCalls:[],orphan:true};
    contexts.push(ctx);
    declarations.push({symbolId,path:s.path,qualifiedContainer:s.path,containerKind:'file',kind:'FILE_FALLBACK',name:s.path,
      canonicalSignature:'file()',visibility:'internal',stateMutability:'nonpayable',lineStart:1,lineEnd:ctx.lineEnd,hasBody:false});
    if(s.astStatus==='MISSING')limitations.push({code:'INVENTORY_INCOMPLETE',path:s.path,detail:'In-scope Solidity source has no admitted AST'});
    else limitations.push({code:'UNSUPPORTED_LANGUAGE_FILE_FALLBACK',path:s.path,detail:'Vyper requires file-level review'});
    const needed=loadTaxonomyV1(new URL('../../../',import.meta.url).pathname).classes.filter(x=>x.testRequired).flatMap(x=>x.triggers);
    triggers[ctx.contextId]=distinct(needed);
  }
  for (const ctx of contexts) {
    const t=temp.get(ctx.contextId), contract=t?.meta?.contract;
    if(contract) {
      ctx.directBases=distinct(contract.directBases??[]);
      ctx.implementedInterfaces=distinct(contract.implementedInterfaces??[]);
      ctx.contractKind=contract.containerKind;
      ctx.contractAbstract=contract.abstract;
    }
    if(t?.meta?.node) {
      const source=t.source.bytes, sourceSlice=sourceText(source,t.meta.node.src);
      const firstLine=ctx.lineStart;
      ctx.senderCheckLines=distinct(sourceSlice.split('\n').flatMap((line,i)=>
        /(?:require|if)\s*\([^;]*msg\.sender|(?:hasRole|_checkRole|canPerform|_authenticateCaller|getActionId|_checkOwner)\s*\(/.test(line)?[firstLine+i]:[])).map(Number);
      ctx.txOriginLines=distinct(sourceSlice.split('\n').flatMap((line,i)=>/tx\.origin/.test(line)?[firstLine+i]:[])).map(Number);
    }
  }
  const triggerObj={};for(const c of [...contexts].sort(byPosition))triggerObj[c.contextId]=distinct([...(triggers[c.contextId]??[])]);
  contexts.sort(byPosition);declarations.sort((a,b)=>a.path.localeCompare(b.path)||a.lineStart-b.lineStart||a.symbolId.localeCompare(b.symbolId));
  limitations.sort((a,b)=>a.path.localeCompare(b.path)||a.code.localeCompare(b.code));
  const byKind={};for(const c of contexts)byKind[c.kind]=(byKind[c.kind]??0)+1;
  return emptyArtifact(campaign,{sourceUnits,declarations,contexts,triggers:triggerObj,limitations,complete,
    counts:{sourceUnits:sourceUnits.length,inScopeUnits:sourceUnits.filter(x=>x.scopeTier==='IN_SCOPE').length,
      declarations:declarations.length,contexts:contexts.length,byKind:Object.fromEntries(Object.entries(byKind).sort(([a],[b])=>a.localeCompare(b))) }});
}

export async function writeReviewInventoryOutputsV1({outputDir,projectRoot,build,request,policy}) {
  if(policy!==POLICY)return;
  const campaign={campaignId:request?.campaignId,campaignGenerationId:request?.campaignGenerationId,
    sourceSha256:request?.source?.archiveSha256,generatedAt:request?.generatedAt};
  try {
    const inventory=await buildReviewInventoryV1({projectRoot,build,campaign});
    const facts=buildSystemFactsV1({inventory});
    await fs.mkdir(outputDir,{recursive:true});
    await fs.writeFile(path.join(outputDir,'REVIEW_INVENTORY_v1.json'),JSON.stringify(inventory,null,2)+'\n');
    await fs.writeFile(path.join(outputDir,'SYSTEM_FACTS_v1.json'),JSON.stringify(facts,null,2)+'\n');
  } catch(e) {
    const payload=blankPayload();
    payload.limitations=[{code:'INVENTORY_BUILD_ERROR',path:'*',detail:String(e?.message??e).slice(0,2000)}];
    try {
      await fs.mkdir(outputDir,{recursive:true});
      await fs.writeFile(path.join(outputDir,'REVIEW_INVENTORY_v1.json'),
        JSON.stringify(emptyArtifact(campaign,payload),null,2)+'\n');
    } catch { /* Phase 0 must continue even when inventory cannot be persisted. */ }
  }
}
