import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CLADDING,FINISHES,OPENINGS,DEPTH_COMPATIBILITY,normalizeConfig,DEFAULT_CONFIG,WIDTHS,allowedDepths,materialById} from '../src/catalog.js';

const catalogue=JSON.parse(await readFile(new URL('../research/catalogue.json',import.meta.url),'utf8'));
const optionIds=key=>new Set(catalogue.attributes.find(a=>a.key===key).options.map(o=>o.id));

test('every cladding finish is a live product option, with the live counts per material',()=>{
 const exterior=optionIds('exterior-cladding-garden-room'),front=optionIds('front-cladding');
 for(const f of FINISHES)assert.ok(exterior.has(f.productId)||front.has(f.productId),`${f.id} (${f.productId}) is not a live cladding option`);
 const count=id=>materialById(id).finishes.length;
 assert.deepEqual({plank:count('plank'),slatted:count('slatted'),wood:count('wood'),steel:count('steel'),brick:count('brick')},{plank:21,slatted:7,wood:2,steel:2,brick:3});
 assert.equal(FINISHES.length,35);
 assert.equal(new Set(FINISHES.map(f=>f.id)).size,FINISHES.length,'finish ids are unique');
 assert.equal(new Set(FINISHES.map(f=>f.productId)).size,FINISHES.length,'no orientation or height duplicates');
 for(const m of CLADDING)assert.equal(new Set(m.finishes.map(f=>f.label)).size,m.finishes.length,`${m.id} labels are unique`);
 // A finish the building type cannot have falls back to that type's default.
 assert.deepEqual(Object.values(normalizeConfig({...DEFAULT_CONFIG,type:'extension',cladding:{front:'steel-black'}}).cladding),Array(4).fill('brick-brickdale'));
 assert.equal(normalizeConfig({...DEFAULT_CONFIG,cladding:{...DEFAULT_CONFIG.cladding,left:'brick-keswick'}}).cladding.left,'cedar');
});

test('every door and window product key exists in the live catalogue',()=>{
 const keys=new Set(catalogue.openingAndFloorProducts.map(p=>p.key));
 for(const o of OPENINGS){
  assert.deepEqual(Object.keys(o.productKeys).sort(),[...o.materials].sort(),`${o.id} has a product for each material`);
  for(const [material,key] of Object.entries(o.productKeys))assert.ok(keys.has(key),`${o.id} ${material}: ${key} missing from openingAndFloorProducts`);
 }
 assert.equal(new Set(OPENINGS.map(o=>o.id)).size,OPENINGS.length);
});

test('every source-approved width/depth remains available, including integer 4m and 9m depths',()=>{
 const depthOptions=catalogue.attributes.find(a=>a.key==='custom-length').options;
 const widthOptions=catalogue.attributes.find(a=>a.key==='custom-width').options;
 assert.deepEqual(widthOptions.map(o=>Number(o.key)/1000),WIDTHS,'widths match the live custom-width list');
 assert.deepEqual(Object.keys(DEPTH_COMPATIBILITY).map(Number).sort((a,b)=>a-b),WIDTHS,'one compatibility row per width');
 for(const width of WIDTHS){
  const widthMm=String(Math.round(width*1000));
  const expected=depthOptions.filter(o=>o.properties['custom-width-multi'].includes(widthMm)).map(o=>Number(o.key)/1000);
  assert.deepEqual(DEPTH_COMPATIBILITY[String(width)],expected,`DEPTH_COMPATIBILITY must match the public catalogue for ${width}m frontage`);
  assert.deepEqual(allowedDepths(width),expected);
  for(const depth of expected)assert.equal(normalizeConfig({...DEFAULT_CONFIG,width,depth}).depth,depth,`Keep approved ${width}m × ${depth}m design`);
 }
 assert.ok(allowedDepths(4).includes(4));
 assert.ok(allowedDepths(2.8).includes(9));
 assert.ok(!allowedDepths(4).includes(9));
 assert.deepEqual(allowedDepths('4.0'),allowedDepths(4));
});
