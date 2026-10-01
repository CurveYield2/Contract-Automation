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

let prepareStatus=null;
let prepareUrl='';
const failures=[];
page.on('response',async r=>{
  const u=r.url();
  if(/\/backend-api\/f\/conversation\/prepare/.test(u)){
    prepareStatus=r.status();
    prepareUrl=new URL(u).origin+new URL(u).pathname;
  }
});
page.on('requestfailed',req=>{
  if(/conversation|backend-api/i.test(req.url())) failures.push({url:req.url().split('?')[0],failure:req.failure()});
});

const result={ok:false,attempt:Number(env.ATTEMPT||'1'),chatUrl:env.CHAT_URL,prepareStatus:null,generating:false,composerCleared:false,unknownError:false,retryVisible:false};

try{
  await page.goto(env.CHAT_URL,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(5000);

  const composer=page.locator('div[role="textbox"][aria-label="Ask ChatGPT"]').first();
  if(!(await composer.isVisible({timeout:30000}).catch(()=>false))) throw new Error('main ChatGPT composer unavailable');

  await composer.click();
  await composer.fill(env.WAKE_MESSAGE).catch(async()=>{
    await composer.focus();
    await page.keyboard.press('Control+A').catch(()=>{});
    await page.keyboard.press('Backspace').catch(()=>{});
    await page.keyboard.insertText(env.WAKE_MESSAGE);
  });

  const send=page.locator('button[aria-label="Send"]').first();
  if(!(await send.isVisible({timeout:5000}).catch(()=>false))) throw new Error('Send button unavailable after fill');
  await send.click();

  const deadline=Date.now()+25000;
  while(Date.now()<deadline){
    await page.waitForTimeout(500);
    const body=await page.locator('body').innerText().catch(()=> '');
    const composerText=await composer.innerText().catch(()=> '');
    const stop=await page.locator('button[data-testid="stop-button"], button[aria-label*="Stop"]').count().catch(()=>0);
    result.prepareStatus=prepareStatus;
    result.generating=stop>0;
    result.composerCleared=!composerText.trim();
    result.unknownError=/Unknown error/i.test(body.slice(-2500));
    result.retryVisible=(await page.getByRole('button',{name:'Retry',exact:true}).count().catch(()=>0))>0;

    if(prepareStatus && prepareStatus>=200 && prepareStatus<300 && result.generating){
      result.ok=true;
      result.prepareUrl=prepareUrl;
      break;
    }
    if(prepareStatus===403 && result.unknownError) break;
  }

  result.prepareStatus=prepareStatus;
  result.prepareUrl=prepareUrl;
  result.failures=failures;
  result.url=page.url();
  console.log(JSON.stringify(result));
  process.exit(result.ok?0:42);
} finally {
  await browser.close().catch(()=>{});
}
