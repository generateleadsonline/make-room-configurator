import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuoteHandler,validateConfig,validateLead} from '../server/quote-service.mjs';
import {createPdfHandler} from '../server/pdf-service.mjs';
import {createRequestHandler} from '../server/request-service.mjs';
import {calculateQuote,publishedBase,designReferenceFor,DESIGNER} from '../server/pricing.mjs';
import {DEFAULT_CONFIG,normalizeConfig,wallsOf} from '../src/catalog.js';
import {INSTALL_TIMES,BUDGETS,BEST_TIMES} from '../src/validation.js';

const id='d6868860-38e1-4ae6-b683-c7d5f8472770';
const otherId='0b5a3f4e-8c1d-4e2f-9a7b-6c5d4e3f2a1b';
const lead={firstName:'QA',lastName:'Test',email:'qa@example.com',phone:'07912 345678',postcode:'HX3 0UA',timeline:'',budget:'',notes:'',marketing:false};
const ctx={deploy:{context:'production'}};
const NOW=Date.UTC(2026,9,11,15);
function fixture(){const records=new Map();let count=0;const store={async setJSON(key,value,opts={}){if(opts.onlyIfNew&&records.has(key))return {modified:false};records.set(key,structuredClone(value));return {modified:true};},async set(key,value){records.set(key,value.slice(0));return {modified:true};},async get(key){return records.has(key)?structuredClone(records.get(key)):null;}};const opts={getStore:()=>store,now:()=>NOW,makeToken:()=>String(++count).padStart(64,'0')};return {records,store,quote:createQuoteHandler(opts),pdf:createPdfHandler(opts),request:createRequestHandler(opts)};}
function req(body,cookie='',path='/api/quote'){return new Request('https://test.netlify.app'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://test.netlify.app',Cookie:cookie},body:JSON.stringify(body)});}
function cookieOf(response){return response.headers.get('set-cookie').split(';')[0];}
function fieldOf(fn){try{fn();}catch(error){return error.field??'(none)';}return null;}
const extension=normalizeConfig({...DEFAULT_CONFIG,type:'extension'});

test('lead validation requires names, email, UK phone and postcode and reports the input name',()=>{
 const ok=validateLead({...lead,phone:'+44 (0)7912 345678',email:' QA@Example.com ',postcode:'hx30ua',timeline:INSTALL_TIMES[1],budget:BUDGETS[0],marketing:true});
 assert.deepEqual(ok,{firstName:'QA',lastName:'Test',email:'qa@example.com',phone:'07912 345678',phoneE164:'+447912345678',postcode:'HX3 0UA',timeline:'3–6 months',budget:'£10,000 – £20,000',notes:'',marketing:true});
 const {timeline,budget,notes,marketing,...required}=lead;
 assert.equal(validateLead(required).timeline,'');
 for(const key of Object.keys(required)){const {[key]:_,...rest}=required;assert.equal(fieldOf(()=>validateLead(rest)),key,`missing ${key}`);}
 assert.equal(fieldOf(()=>validateLead({...lead,firstName:'R2D2'})),'firstName');
 assert.equal(fieldOf(()=>validateLead({...lead,lastName:'<b>'})),'lastName');
 assert.equal(fieldOf(()=>validateLead({...lead,email:'broken'})),'email');
 assert.equal(fieldOf(()=>validateLead({...lead,phone:'07700 900123'})),'phone');
 assert.equal(fieldOf(()=>validateLead({...lead,phone:'0845 123 4567'})),'phone');
 assert.equal(fieldOf(()=>validateLead({...lead,postcode:'NONE'})),'postcode');
 assert.equal(fieldOf(()=>validateLead({...lead,timeline:'Tomorrow'})),'timeline');
 assert.equal(fieldOf(()=>validateLead({...lead,budget:'£1'})),'budget');
 assert.equal(fieldOf(()=>validateLead({...lead,notes:'x'.repeat(1201)})),'notes');
 assert.equal(validateLead({...lead,notes:'Line one\nLine two'}).notes,'Line one\nLine two');
 assert.ok(fieldOf(()=>validateLead({...lead,marketing:'yes'})));
 assert.ok(fieldOf(()=>validateLead({...lead,name:'Old field'})));
});

test('v2 config validation accepts only already-normalised designs',()=>{
 assert.deepEqual(validateConfig(DEFAULT_CONFIG),DEFAULT_CONFIG);
 assert.deepEqual(validateConfig(extension),extension);
 const reordered=Object.fromEntries(Object.entries(DEFAULT_CONFIG).reverse());
 assert.deepEqual(validateConfig(reordered),DEFAULT_CONFIG,'key order carries no meaning');
 const mixed=normalizeConfig({...DEFAULT_CONFIG,cladding:{front:'cedar',back:'plank-c74',left:'slatted-midnight',right:'steel-black'}});
 assert.deepEqual(validateConfig(mixed).cladding,{front:'cedar',back:'plank-c74',left:'slatted-midnight',right:'steel-black'});
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,price:1})),'config','tampered price key');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,total:0})),'config');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,v:1})),'config');
 assert.equal(fieldOf(()=>validateConfig(null)),'config');
 const moved=structuredClone(DEFAULT_CONFIG);moved.openings[0].offset=0.3;
 assert.equal(fieldOf(()=>validateConfig(moved)),'openings','un-normalised opening offset');
 const jitter=structuredClone(DEFAULT_CONFIG);jitter.openings[0].offset=2.0004;
 assert.equal(fieldOf(()=>validateConfig(jitter)),'openings');
 const overlap=structuredClone(DEFAULT_CONFIG);overlap.openings.push({id:'o3',product:'single-door',material:'alu',colour:'black',wall:'front',offset:2});
 assert.equal(fieldOf(()=>validateConfig(overlap)),'openings');
 const extra=structuredClone(DEFAULT_CONFIG);extra.openings[0].price=1;
 assert.equal(fieldOf(()=>validateConfig(extra)),'openings');
 const upvcBifold=structuredClone(DEFAULT_CONFIG);upvcBifold.openings[0].material='upvc';
 assert.equal(fieldOf(()=>validateConfig(upvcBifold)),'openings');
 const textOffset=structuredClone(DEFAULT_CONFIG);textOffset.openings[0].offset='2';
 assert.equal(fieldOf(()=>validateConfig(textOffset)),'openings');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,openings:Array.from({length:25},(_,i)=>({...DEFAULT_CONFIG.openings[1],id:`o${i}`}))})),'openings');
 assert.equal(fieldOf(()=>validateConfig({...extension,cladding:wallsOf('steel-anthracite')})),'cladding','steel on an extension');
 assert.equal(fieldOf(()=>validateConfig({...extension,cladding:{...extension.cladding,left:'plank-c74'}})),'cladding','extension uses one finish');
 const backDoor=structuredClone(extension);backDoor.openings.push({id:'o3',product:'single-door',material:'alu',colour:'black',wall:'back',offset:2});
 assert.equal(fieldOf(()=>validateConfig(backDoor)),'openings','back-wall opening on an extension');
 assert.equal(fieldOf(()=>validateConfig({...extension,overhang:{...extension.overhang,back:0.3}})),'overhang');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,cladding:{...DEFAULT_CONFIG.cladding,left:'plank-c99'}})),'cladding','unknown finish');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,brick:'x'})),'config');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,width:4.1})),'width');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,width:'4'})),'width');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,width:10.77,depth:8.3})),'depth');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,overhang:{...DEFAULT_CONFIG.overhang,front:0.47}})),'overhang');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,decking:{...DEFAULT_CONFIG.decking,left:Infinity}})),'decking');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,deckingColour:'pink'})),'deckingColour');
 assert.equal(fieldOf(()=>validateConfig({...DEFAULT_CONFIG,electrical:'deluxe'})),'electrical');
 assert.deepEqual(validateConfig({...DEFAULT_CONFIG,electrical:'none'}).electrical,'none');
});

test('pricing uses the published guide plus one £3,500 allowance per bi-fold, nothing invented',()=>{
 assert.equal(publishedBase(12).amount,16500);
 assert.equal(publishedBase(11.2).amount,15700);
 assert.deepEqual([publishedBase(7).amount,publishedBase(7).startingOnly],[9980,true]);
 assert.equal(publishedBase(24).amount,26000);
 assert.equal(publishedBase(25),null);
 const q=calculateQuote(DEFAULT_CONFIG);
 assert.equal(q.total,15700+3500,'default design has one 3 panel bifold');
 assert.match(q.designReference,/^MR-[A-F0-9]{12}$/);
 assert.equal(q.designReference,designReferenceFor(DEFAULT_CONFIG));
 assert.deepEqual(q.items.filter(x=>x.amount!==null).map(x=>x.amount),[15700,3500]);
 assert.ok(q.items.filter(x=>x.amount===null).every(x=>x.value===DESIGNER&&DESIGNER==='Priced by your designer'));
 assert.ok(q.items.some(x=>/^W1 Right: 100% TOV Window/.test(x.label)&&x.value===DESIGNER));
 assert.ok(q.items.some(x=>x.label==='Roof overhang · Front 450mm'));
 assert.ok(q.items.some(x=>x.label.startsWith('Decking · Front 1.20m')));
 assert.ok(q.items.some(x=>x.label==='Electrics · Standard package'));
 assert.ok(!calculateQuote({...DEFAULT_CONFIG,electrical:'none'}).items.some(x=>x.label.startsWith('Electrics')));
 assert.equal(calculateQuote({...DEFAULT_CONFIG,electrical:'premium'}).total,19200,'options never change the published figure');
 const noBifold=normalizeConfig({...DEFAULT_CONFIG,openings:[{id:'o1',product:'french-door-large',material:'upvc',colour:'black',wall:'front',offset:2}]});
 assert.equal(calculateQuote(noBifold).total,15700);
 const twoBifolds=normalizeConfig({...DEFAULT_CONFIG,width:6.5,depth:3.4,openings:[{id:'o1',product:'bifold-3',material:'alu',colour:'black',wall:'front',offset:1.6},{id:'o2',product:'bifold-3',material:'alu',colour:'black',wall:'left',offset:1.7}]});
 assert.equal(twoBifolds.openings.length,2);
 const two=calculateQuote(twoBifolds);
 assert.equal(two.total,publishedBase(22.1).amount+7000);
 assert.equal(two.allowances[0].count,2);
 assert.equal(calculateQuote({...DEFAULT_CONFIG,type:'extension'}).total,null);
 assert.ok(calculateQuote({...DEFAULT_CONFIG,type:'extension'}).items.every(x=>x.amount===null));
 assert.equal(calculateQuote({...DEFAULT_CONFIG,width:5.9,depth:5.2}).total,null,'over 24 m² is a specialist quote');
 assert.equal(calculateQuote(DEFAULT_CONFIG,{mode:'quote-only'}).total,null);
 assert.ok(q.exclusions.some(x=>/decking/i.test(x))&&q.exclusions.some(x=>/groundwork/i.test(x))&&q.exclusions.some(x=>/site access/i.test(x)));
});

test('quote and PDF cannot unlock before validated saved lead',async()=>{const f=fixture();const q=await f.quote(req({config:DEFAULT_CONFIG}),ctx);assert.equal(q.status,401);assert.equal(f.records.size,0);const response=await f.pdf(new Request('https://test.netlify.app/api/design-pack?designReference=MR-BB83220DACC2'),ctx);assert.equal(response.status,401);const bad=await f.quote(req({config:DEFAULT_CONFIG,lead:{...lead,phone:'07700 900123'},requestId:id}),ctx);assert.equal(bad.status,400);assert.equal((await bad.json()).field,'phone');const tampered=await f.quote(req({config:{...DEFAULT_CONFIG,width:4.1},lead,requestId:id}),ctx);assert.equal(tampered.status,400);assert.equal((await tampered.json()).field,'width');assert.equal(f.records.size,0);});
test('initial lead receipt stays immutable and revisions unlock their own PDF',async()=>{const f=fixture();const response=await f.quote(req({config:DEFAULT_CONFIG,lead,requestId:id,botField:''}),ctx);assert.equal(response.status,200);const body=await response.json();assert.equal(body.saved,true);assert.equal(body.quote.total,19200);assert.ok(response.headers.get('set-cookie').includes('HttpOnly'));assert.ok(response.headers.get('set-cookie').includes('Secure'));assert.ok(response.headers.get('set-cookie').includes('Path=/api'));const stored=f.records.get('leads/'+id);assert.equal(stored.lead.phoneE164,'+447912345678');assert.equal(stored.submittedAt,new Date(NOW).toISOString());assert.equal(stored.source,'Make Room Outside Living configurator');const cookie=cookieOf(response);const original=structuredClone(stored);const config=normalizeConfig({...DEFAULT_CONFIG,width:4.6,electrical:'premium'});const updated=await f.quote(req({config},cookie),ctx);assert.equal(updated.status,200);const revision=(await updated.json()).quote;assert.notEqual(revision.designReference,body.quote.designReference);assert.equal(revision.reference,body.quote.reference);assert.deepEqual(f.records.get('leads/'+id),original);const bytes=new TextEncoder().encode('%PDF-1.7\n1 0 obj <<>> endobj\n%%EOF\n');const saved=await f.pdf(new Request('https://test.netlify.app/api/design-pack',{method:'POST',headers:{'Content-Type':'application/pdf','X-Design-Reference':revision.designReference,Cookie:cookie},body:bytes}),ctx);assert.equal(saved.status,200);const link=(await saved.json()).downloadUrl;const downloaded=await f.pdf(new Request('https://test.netlify.app'+link,{headers:{Cookie:cookie}}),ctx);assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('content-type'),'application/pdf');assert.equal((await downloaded.arrayBuffer()).byteLength,bytes.length);const stranger=await f.pdf(new Request('https://test.netlify.app'+link),ctx);assert.equal(stranger.status,401);const unnormalised=await f.quote(req({config:{...config,openings:[{...config.openings[0],offset:0.2}]}},cookie),ctx);assert.equal(unnormalised.status,400);assert.equal((await unnormalised.json()).field,'openings');});
test('changed reuse of a submission id is refused and cross-site requests fail',async()=>{const f=fixture();assert.equal((await f.quote(req({config:DEFAULT_CONFIG,lead,requestId:id}),ctx)).status,200);assert.equal((await f.quote(req({config:DEFAULT_CONFIG,lead:{...lead,firstName:'Changed'},requestId:id}),ctx)).status,409);const request=req({config:DEFAULT_CONFIG,lead,requestId:id});request.headers.set('origin','https://evil.example');assert.equal((await f.quote(request,ctx)).status,403);});
test('storage failure never returns quote or saved success',async()=>{const f=createQuoteHandler({getStore:()=>({setJSON:async()=>{throw new Error('Unavailable');}})});const response=await f(req({config:DEFAULT_CONFIG,lead,requestId:id}),ctx);assert.equal(response.status,503);const body=await response.json();assert.equal(body.quote,undefined);assert.equal(body.saved,undefined);});
test('lead retry and revision retry are idempotent without rewriting original receipt',async()=>{const f=fixture();const first=await f.quote(req({config:DEFAULT_CONFIG,lead,requestId:id}),ctx);const firstBody=await first.json();const retry=await f.quote(req({config:DEFAULT_CONFIG,lead,requestId:id}),ctx);assert.equal(retry.status,200);assert.deepEqual((await retry.json()).quote,firstBody.quote);const cookie=cookieOf(retry),revisionId='916934f0-71e8-4651-b878-6e4c5f3e3e58',config=normalizeConfig({...DEFAULT_CONFIG,width:4.6});const update=await f.quote(req({config,requestId:revisionId},cookie),ctx);const updateBody=await update.json();const again=await f.quote(req({config,requestId:revisionId},cookie),ctx);assert.equal(again.status,200);assert.deepEqual((await again.json()).quote,updateBody.quote);const conflict=await f.quote(req({config:normalizeConfig({...DEFAULT_CONFIG,width:5.2}),requestId:revisionId},cookie),ctx);assert.equal(conflict.status,409);});

const callback={topic:'callback',firstName:'QA',lastName:'Test',phone:'01422 580172',requestId:otherId,botField:''};
const send=(f,body,cookie='')=>f.request(req(body,cookie,'/api/request'),ctx);
test('callback requests need a name and UK phone, not an email',async()=>{
 const f=fixture();
 const response=await send(f,callback);
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{saved:true,reference:'MR-REQ-0B5A3F4E'});
 const record=f.records.get('requests/'+otherId);
 assert.equal(record.topic,'callback');
 assert.deepEqual(record.contact,{firstName:'QA',lastName:'Test',phone:'01422 580172',phoneE164:'+441422580172',email:'',postcode:''});
 assert.equal(record.leadId,null);
 assert.equal(record.config,null);
 assert.equal(record.submittedAt,new Date(NOW).toISOString());
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
});
test('brochure needs an email, bad phones and dates are refused by field',async()=>{
 const f=fixture();
 const fail=async(body,field,status=400)=>{const r=await send(f,{...callback,...body});assert.equal(r.status,status,JSON.stringify(body));assert.equal((await r.json()).field,field,JSON.stringify(body));};
 await fail({topic:'brochure'},'email');
 await fail({topic:'brochure',email:'nope'},'email');
 await fail({phone:'07700 900123'},'phone');
 await fail({phone:'0906 123 4567'},'phone');
 await fail({phone:''},'phone');
 await fail({lastName:''},'lastName');
 await fail({topic:'quote'},'topic');
 await fail({email:'not-an-email'},'email');
 await fail({postcode:'ZZ'},'postcode');
 await fail({bestTime:'Midnight'},'bestTime');
 await fail({topic:'visit',preferredDate:'2026-10-10'},'preferredDate');
 await fail({topic:'visit',preferredDate:'2027-02-09'},'preferredDate');
 await fail({topic:'visit',preferredDate:'2026-02-30'},'preferredDate');
 await fail({config:{...DEFAULT_CONFIG,price:1}},'config');
 assert.equal(f.records.size,0);
 const bot=await send(f,{...callback,botField:'http://spam'});assert.equal(bot.status,400);
 const badId=await send(f,{...callback,requestId:'123'});assert.equal(badId.status,400);
 const unknown=await send(f,{...callback,price:1});assert.equal(unknown.status,400);
 assert.equal((await f.request(new Request('https://test.netlify.app/api/request'),ctx)).status,405);
 assert.equal(f.records.size,0);
 const ok=await send(f,{...callback,topic:'brochure',email:'QA@example.com',postcode:'hx3 0ua',bestTime:BEST_TIMES[0],marketing:true,config:DEFAULT_CONFIG});
 assert.equal(ok.status,200);
 const record=f.records.get('requests/'+otherId);
 assert.equal(record.contact.email,'qa@example.com');
 assert.equal(record.contact.postcode,'HX3 0UA');
 assert.equal(record.designReference,designReferenceFor(DEFAULT_CONFIG));
 assert.equal(record.consent.marketing,true);
 const visit=await send(f,{...callback,topic:'visit',preferredDate:'2026-10-11',requestId:'5e0c8a2b-1d3f-4a6b-8c9d-0e1f2a3b4c5d'});
 assert.equal(visit.status,200,'today is allowed');
 const later=await send(f,{...callback,topic:'visit',preferredDate:'2027-02-08',requestId:'6e0c8a2b-1d3f-4a6b-8c9d-0e1f2a3b4c5d'});
 assert.equal(later.status,200,'120 days ahead is allowed');
});
test('request replay is idempotent, a changed replay conflicts, cross-origin fails',async()=>{
 const f=fixture();
 const first=await (await send(f,callback)).json();
 const again=await send(f,callback);
 assert.equal(again.status,200);
 assert.deepEqual(await again.json(),first);
 assert.equal(f.records.size,1);
 assert.equal((await send(f,{...callback,notes:'Changed'})).status,409);
 const cross=req(callback,'','/api/request');cross.headers.set('origin','https://evil.example');
 assert.equal((await f.request(cross,ctx)).status,403);
 const fetchSite=new Request('https://test.netlify.app/api/request',{method:'POST',headers:{'Content-Type':'application/json','Sec-Fetch-Site':'cross-site'},body:JSON.stringify(callback)});
 assert.equal((await f.request(fetchSite,ctx)).status,403);
});
test('a saved quote session links the request to its lead',async()=>{
 const f=fixture();
 const cookie=cookieOf(await f.quote(req({config:DEFAULT_CONFIG,lead,requestId:id}),ctx));
 assert.equal((await send(f,callback,cookie)).status,200);
 assert.equal(f.records.get('requests/'+otherId).leadId,id);
 assert.equal((await send(f,callback,'make_room_quote_session='+'f'.repeat(64))).status,200,'a stale session is ignored, not required');
});
test('request storage failure reports 503 without saved success',async()=>{
 const h=createRequestHandler({getStore:()=>({get:async()=>null,setJSON:async()=>{throw new Error('Unavailable');}})});
 const response=await h(req(callback,'','/api/request'),ctx);
 assert.equal(response.status,503);
 assert.equal((await response.json()).saved,undefined);
});
