#!/usr/bin/env node
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const rr=createRequire(path.join(process.env.BROWSER_AGENT_RUNTIME_ROOT,'package.json'));
const mod=await import(pathToFileURL(rr.resolve('playwright-core')).href);
const a=mod.default&&typeof mod.default==='object'?mod.default:mod;
const b=a.default&&typeof a.default==='object'?a.default:a;
const chromium=mod.chromium||a.chromium||b.chromium;
const storage=JSON.parse(Buffer.from(process.env.CHATGPT_STORAGE_STATE_B64,'base64').toString('utf8'));
const browser=await chromium.launch({headless:false,channel:'chrome'});
const context=await browser.newContext({storageState:storage});
const page=await context.newPage();
try{
  await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(12000);
  const now=Date.now()/1000;
  const cookies=await context.cookies('https://chatgpt.com');
  const meta=cookies.filter(c=>c.name==='__cf_bm'||c.name==='cf_clearance').map(c=>({
    name:c.name,domain:c.domain,path:c.path,expires:c.expires,
    secondsRemaining:c.expires>0?c.expires-now:null,httpOnly:c.httpOnly,secure:c.secure,sameSite:c.sameSite
  }));
  const probe=await page.evaluate(async()=>{
    try{
      const r=await fetch('/backend-api/models',{credentials:'include',cache:'no-store'});
      const c=await fetch('/backend-api/conversations?offset=0&limit=1&order=updated',{credentials:'include',cache:'no-store'});
      return {
        models:{status:r.status,cfMitigated:r.headers.get('cf-mitigated')},
        conversations:{status:c.status,cfMitigated:c.headers.get('cf-mitigated')}
      };
    }catch(e){return {error:String(e)}}
  });
  console.log(JSON.stringify({now,meta,probe},null,2));
}finally{await browser.close();}
