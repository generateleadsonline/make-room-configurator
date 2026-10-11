import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CLADDING_FINISHES,normalizeConfig,DEFAULT_CONFIG,WIDTHS,allowedDepths} from '../src/catalog.js';
test('finish choices are the live product allowed IDs, without orientation or height duplicates',async()=>{
 const catalogue=JSON.parse(await readFile(new URL('../research/catalogue.json',import.meta.url),'utf8'));
 const allowed=new Set(catalogue.attributes.find(a=>a.key==='exterior-cladding-garden-room').options.map(o=>o.id));
 const finishes=Object.values(CLADDING_FINISHES).flat();
 assert.equal(finishes.length,35);assert.equal(CLADDING_FINISHES.plank.length,21);assert.equal(CLADDING_FINISHES.slatted.length,7);
 assert.ok(finishes.every(x=>allowed.has(x.productId)));
 for(const options of Object.values(CLADDING_FINISHES))assert.equal(new Set(options.map(x=>x.label)).size,options.length);
 const impossible=normalizeConfig({...DEFAULT_CONFIG,cladding:'slatted',claddingColor:'SLATTED-HORIZONTAL-3.6-Havana'});
 assert.equal(impossible.claddingColor,'SLATTED-VERTICAL-2.5-Midnight');
});


test('every source-approved width/depth remains available, including integer 4m and 9m depths',async()=>{
 const catalogue=JSON.parse(await readFile(new URL('../research/catalogue.json',import.meta.url),'utf8'));
 const depthOptions=catalogue.attributes.find(a=>a.key==='custom-length').options;
 for(const width of WIDTHS){
  const widthMm=String(Math.round(width*1000));
  const expected=depthOptions.filter(o=>o.properties['custom-width-multi'].includes(widthMm)).map(o=>Number(o.key)/1000);
  assert.deepEqual(allowedDepths(width),expected,`Widths and depths must match the public catalogue for ${width}m frontage`);
  for(const depth of expected)assert.equal(normalizeConfig({...DEFAULT_CONFIG,width,depth}).depth,depth,`Keep approved ${width}m × ${depth}m design`);
 }
 assert.ok(allowedDepths(4).includes(4));
 assert.ok(allowedDepths(2.8).includes(9));
 assert.ok(!allowedDepths(4).includes(9));
 assert.deepEqual(allowedDepths('4.0'),allowedDepths(4));
});
