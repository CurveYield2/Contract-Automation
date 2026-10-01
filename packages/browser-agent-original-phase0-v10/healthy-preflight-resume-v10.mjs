#!/usr/bin/env node
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const env=process.env;
const rr=createRequire(path.join(env.BROWSER_AGENT_RUNTIME_ROOT,'package.json'));
const mod=await import(pathToFileURL(rr.resolve('playwright-core')).href);
const a=mod.default&&typeof mod.default==='object'?mod.default:mod;
const b=a.default&&typeof a.default==='object'?a.default:a;
const chromium=mod.chromium||a.chromium||b.chromium;
if(!chromium||typeof chromium.launch!=='function') throw new Error('chromium unavailable');

const storage=JSON.parse(Buffer.from(env.CHATGPT_STORAGE_STATE_B64,'base64').toString('utf8'));
const browser=await chromium.launch({headless:false,channel:'chrome'});
const context=await browser.newContext({storageState:storage});
const page=await context.newPage();

const id=new URL(env.CHAT_URL).pathname.split('/').filter(Boolean).pop();
const probes=[];
let prepareStatus=null;
let prepareHeaders={};

page.on('response',async r=>{
  if(/\/backend-api\/f\/conversation\/prepare/.test(r.url())){
    prepareStatus=r.status();
    const h=await r.allHeaders().catch(()=>({}));
    prepareHeaders={
      server:h.server||null,
      cfMitigated:h['cf-mitigated']||null,
      cfRay:h['cf-ray']||null,
      contentType:h['content-type']||null
    };
  }
});

async function probe(label){
  const result=await page.evaluate(async (conversationId)=>{
    try{
      const r=await fetch('/backend-api/conversations/'+conversationId,{credentials:'include',cache:'no-store'});
      return {status:r.status,ok:r.ok,contentType:r.headers.get('content-type'),cfMitigated:r.headers.get('cf-mitigated'),server:r.headers.get('server'),cfRay:r.headers.get('cf-ray')};
    }catch(e){return {status:0,ok:false,error:String(e)}}
  },id);
  const cookies=await context.cookies('https://chatgpt.com').catch(()=>[]);
  const names=[...new Set(cookies.map(c=>c.name))].sort();
  const item={label,...result,cookieNames:names};
  probes.push(item);
  console.log('[preflight] '+JSON.stringify(item));
  return item;
}

const out={ok:false,chatUrl:env.CHAT_URL,probes,prepareStatus:null,generating:false};
try{
  await page.goto(env.CHAT_URL,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(5000);

  const checkpoints=[0,5000,10000,20000,30000];
  let lastElapsed=0;
  let healthy=false;
  for(const target of checkpoints){
    const delay=target-lastElapsed;
    if(delay>0) await page.waitForTimeout(delay);
    lastElapsed=target;
    const p=await probe('t+'+target/1000+'s');
    if(p.ok){healthy=true;break;}
    await page.reload({waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{});
    await page.waitForTimeout(1500);
  }

  out.preflightHealthy=healthy;
  if(!healthy){
    console.log(JSON.stringify(out));
    process.exit(42);
  }

  const composer=page.locator('div[role="textbox"][aria-label="Ask ChatGPT"]').first();
  if(!(await composer.isVisible({timeout:30000}).catch(()=>false))) throw new Error('main composer unavailable after healthy preflight');
  await composer.click();
  await composer.fill(env.WAKE_MESSAGE).catch(async()=>{
    await composer.focus();
    await page.keyboard.press('Control+A').catch(()=>{});
    await page.keyboard.press('Backspace').catch(()=>{});
    await page.keyboard.insertText(env.WAKE_MESSAGE);
  });
  const send=page.locator('button[aria-label="Send"]').first();
  if(!(await send.isVisible({timeout:5000}).catch(()=>false))) throw new Error('send button unavailable');
  await send.click();

  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    await page.waitForTimeout(500);
    const stop=await page.locator('button[data-testid="stop-button"], button[aria-label*="Stop"]').count().catch(()=>0);
    out.prepareStatus=prepareStatus;
    out.prepareHeaders=prepareHeaders;
    out.generating=stop>0;
    if(prepareStatus && prepareStatus>=200 && prepareStatus<300 && out.generating){out.ok=true;break;}
    if(prepareStatus===403) break;
  }
  const composerText=await composer.innerText().catch(()=> '');
  out.composerCleared=!composerText.trim();
  out.url=page.url();
  console.log(JSON.stringify(out));
  process.exit(out.ok?0:42);
} finally {
  await browser.close().catch(()=>{});
}
