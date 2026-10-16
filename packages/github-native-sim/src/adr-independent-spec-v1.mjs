import fs from 'node:fs';
import path from 'node:path';
const normative=/\b(?:must|shall|should|require|only|never|always|ensure|at least|maximum|minimum|invariant|expected|forbidden|cannot)\b/i;
const docsRe=/^(?:README(?:[._-].+)?|[^/]+\.(?:md|mdx|rst|txt))$/i;
const escapeReg=x=>x.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
function locate(sourceRoot,rel){
 const direct=path.join(sourceRoot,...rel.split('/'));
 if(fs.existsSync(direct)&&fs.statSync(direct).isFile())return direct;
 for(const ent of fs.existsSync(sourceRoot)?fs.readdirSync(sourceRoot,{withFileTypes:true}):[]){
  if(!ent.isDirectory()||ent.name.startsWith('.'))continue;
  const file=path.join(sourceRoot,ent.name,...rel.split('/'));
  if(fs.existsSync(file)&&fs.statSync(file).isFile())return file;
 }
 return null;
}
export function independentSpecItemsV13({root,campaignPath,context,otherContexts=[]}={}){
 const sourceRoot=path.join(root,...campaignPath.split('/'),'source'),rules=[],referenceConstants=[];
 const file=locate(sourceRoot,context.path);
 if(file){
  const lines=fs.readFileSync(file,'utf8').split('\n');
  for(let i=Math.max(0,context.lineStart-16);i<Math.min(lines.length,context.lineStart+3);i++){
   if(/^\s*(?:\/\/|\/\*|\*|\*\/)/.test(lines[i])&&normative.test(lines[i])){
    const txt=lines[i].replace(/^\s*(?:\/\/\/?|\/\*+|\*|\/)\s*/,'').trim();
    rules.push({type:'SOURCE_COMMENT',ruleId:'COMMENT:'+context.contextId+':'+(i+1),
     sourceAnchor:context.path+':L'+(i+1),rule:txt.slice(0,2048)});
   }
  }
 }
 const name=String(context.canonicalSignature??'').split('(')[0],visits=[];
 let docCount=0;
 function collect(dir,depth=0){
  if(depth>4||docCount>=8)return;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
   if(ent.isDirectory()&&!['.git','vendor','node_modules','lib','ipor-fusion','out','build','artifacts'].includes(ent.name))
    collect(path.join(dir,ent.name),depth+1);
   else if(ent.isFile()&&docsRe.test(ent.name)&&docCount++<8)visits.push(path.join(dir,ent.name));
  }
 }
 if(fs.existsSync(sourceRoot))collect(sourceRoot);
 const match=name.length>2?new RegExp('\\b'+escapeReg(name)+'\\b','i'):null;
 for(const doc of visits){
  if(fs.statSync(doc).size>512*1024)continue;
  const lines=fs.readFileSync(doc,'utf8').split('\n');
  for(let i=0;i<lines.length;i++){
   if(normative.test(lines[i])&&match?.test(lines.slice(Math.max(0,i-2),Math.min(i+3,lines.length)).join(' '))){
    const rel=path.relative(sourceRoot,doc).split(path.sep).join('/');
    rules.push({type:'README_OR_DOC',ruleId:'DOC:'+context.contextId+':'+rel+':'+(i+1),
     sourceAnchor:'source/'+rel+':L'+(i+1),rule:lines[i].trim().slice(0,2048)});
    if(rules.length>=24)break;
   }
  }
 }
 for(const c of otherContexts.filter(x=>x.contextId!==context.contextId&&x.kind==='CONSTANT'&&
  typeof x.declaredValue==='string'&&x.declaredValue!=='UNINITIALIZED').slice(0,24)){
  if(c.qualifiedContainer!==context.qualifiedContainer)referenceConstants.push({
   sourceAnchor:c.path+':L'+c.lineStart,constant:c.canonicalSignature,
   observedValue:c.declaredValue,sourceContract:c.qualifiedContainer,
   note:'Observed code value only; not an independent specification'});
 }
 return {documentationItems:rules.slice(0,24),referenceConstants,checkedDocCount:docCount,
  sourceCommentsChecked:Boolean(file),missingSource:!file};
}
