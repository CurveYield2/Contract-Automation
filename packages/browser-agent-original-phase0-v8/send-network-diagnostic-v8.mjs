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
if(!chromium) throw new Error('chromium unavailable');

const storage=JSON.parse(Buffer.from(env.CHATGPT_STORAGE_STATE_B64,'base64').toString('utf8'));
const browser=await chromium.launch({headless:false,channel:'chrome'});
const context=await browser.newContext({storageState:storage});
const page=await context.newPage();

const events=[];
const keepUrl=(raw)=>{try{const u=new URL(raw);return u.origin+u.pathname}catch{return raw}};
page.on('response',async r=>{
  const req=r.request();
  const url=keepUrl(r.url());
  if(req.method()==='POST'||r.status()>=400||/conversation|backend-api|sentinel|graphql|messages|responses/i.test(url)){
    let body='';
    if(r.status()>=400){body=await r.text().catch(()=> ''); body=body.slice(0,1600);}
    events.push({kind:'response',method:req.method(),status:r.status(),url,body});
  }
});
page.on('requestfailed',req=>events.push({kind:'requestfailed',method:req.method(),url:keepUrl(req.url()),failure:req.failure()}));
page.on('console',msg=>{if(/error|failed|conversation|network/i.test(msg.text())) events.push({kind:'console',type:msg.type(),text:msg.text().slice(0,1200)})});

try{
  await page.goto(env.CHAT_URL,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(5000);
  const composer=page.locator('div[role="textbox"][aria-label="Ask ChatGPT"]').filter({visible:true}).first();
  if(!(await composer.isVisible().catch(()=>false))) throw new Error('confirmed current composer not visible');
  await composer.click();
  await page.keyboard.insertText(env.WAKE_MESSAGE);
  await page.waitForTimeout(500);
  const send=page.locator('button[aria-label="Send"]').filter({visible:true}).first();
  if(!(await send.isVisible().catch(()=>false))) throw new Error('send button not visible after input');
  await send.click();
  await page.waitForTimeout(12000);
  const body=(await page.locator('body').innerText().catch(()=> '')).slice(-4000);
  const composerText=await composer.innerText().catch(()=> '');
  const retryCount=await page.getByRole('button',{name:'Retry',exact:true}).count().catch(()=>0);
  const stopCount=await page.locator('button[data-testid="stop-button"], button[aria-label*="Stop"]').count().catch(()=>0);
  console.log(JSON.stringify({url:page.url(),composerText,retryCount,stopCount,bodyTail:body,events},null,2));
} finally {
  await browser.close();
}
