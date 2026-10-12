import {createHash} from 'node:crypto';
import {normalizeConfig,claddingSummary,schedule,openingLabel,sidesSummary,electricalById,summaryRows,WALLS,WALL_LABELS,DECKING_COLOURS,FLOORS} from '../src/catalog.js';

// Published illustrations are a planning guide, never a Make Room tariff.
// Keep all amounts server-side so that the browser cannot reveal them before a saved enquiry.
export const GUIDE_SOURCE='https://www.makeroomoutside.co.uk/news-media/how-much-is-a-garden-room/';
export const GUIDE_PUBLISHED_AT='2024-01-09';
export const START_SOURCE='https://www.makeroomoutside.co.uk/products/garden-rooms/';
// Garden-rooms page, checked 12 Oct 2026: "Office £9,980" (research/website-2026-10-12/findings.md).
export const PUBLISHED_START_PRICE=9980;
// Cost guide (9 Jan 2024): bi-fold upgrade from £3,500 (research/source-audit.md).
export const BIFOLD_ALLOWANCE=3500;
export const PUBLISHED_GUIDE=Object.freeze([[7.5,11500],[9,13500],[12,16500],[15,20000],[18,23000],[20,23500],[24,26000]]);
export const DESIGNER='Priced by your designer';
const round=value=>Math.round(value/100)*100;

export function publishedBase(area){
 if(area<7.5)return {amount:PUBLISHED_START_PRICE,basis:'Published garden-room starting price',sourceUrl:START_SOURCE,startingOnly:true};
 if(area>24)return null;
 for(let i=1;i<PUBLISHED_GUIDE.length;i++){
  const [a,p]=PUBLISHED_GUIDE[i-1],[b,q]=PUBLISHED_GUIDE[i];
  if(area<=b)return {amount:round(p+(q-p)*(area-a)/(b-a)),basis:'Size guide from published examples',sourceUrl:GUIDE_SOURCE,startingOnly:false};
 }
 return null;
}
export const isBifold=opening=>String(opening.product).startsWith('bifold');
export function designReferenceFor(input){
 return 'MR-'+createHash('sha256').update(JSON.stringify(normalizeConfig(input))).digest('hex').slice(0,12).toUpperCase();
}

export function calculateQuote(input,{reference='MR-DESIGN',createdAt=new Date().toISOString(),mode=process.env.MAKE_ROOM_PRICING_MODE||'published-guide'}={}){
 const config=normalizeConfig(input),area=Number((config.width*config.depth).toFixed(4));
 const designReference=designReferenceFor(config);
 const base=mode==='quote-only'||config.type==='extension'?null:publishedBase(area);
 const scope='Published Make Room illustrations for a garden room of this size. Your designer prices the final specification: cladding, doors and windows, roof overhangs, decking, flooring, electrics, groundwork, delivery, installation and site access.';
 const exclusions=[
  'Cladding finishes on each wall',
  'Door and window sizes, positions and frames (bi-fold doors include only the published minimum allowance)',
  'Roof overhangs and soffits',
  'Composite decking',
  'Flooring',
  'Electrical package and mains connection',
  'Groundwork, base and site preparation',
  'Delivery distance, installation conditions and site access',
  'Planning permission, building regulations and any bespoke work',
 ];
 const items=[];
 let total=null;
 if(base){
  items.push({label:base.basis,amount:base.amount,note:base.startingOnly?'An entry price for the range; not a price for this particular small design.':'Area interpolation between published example prices; specification may differ.'});
  total=base.amount;
 }
 items.push({label:`Cladding · ${claddingSummary(config)}`,amount:null,value:DESIGNER});
 let bifolds=0;
 for(const o of schedule(config)){
  const label=`${o.tag} ${WALL_LABELS[o.wall]}: ${openingLabel(o)}`;
  if(base&&isBifold(o)){
   bifolds++;
   total+=BIFOLD_ALLOWANCE;
   items.push({label,amount:BIFOLD_ALLOWANCE,note:'Published minimum bi-fold allowance: Make Room’s cost guide lists bi-fold upgrades from £3,500. Size and finish may cost more.'});
  }else items.push({label,amount:null,value:DESIGNER});
 }
 for(const w of WALLS)if(config.overhang[w]>0)items.push({label:`Roof overhang · ${WALL_LABELS[w]} ${Math.round(config.overhang[w]*1000)}mm`,amount:null,value:DESIGNER});
 if(WALLS.some(w=>config.decking[w]>0)){
  const colour=DECKING_COLOURS.find(d=>d.id===config.deckingColour)?.label;
  items.push({label:`Decking · ${sidesSummary(config.decking)} · ${colour} composite`,amount:null,value:DESIGNER});
 }
 items.push({label:`Flooring · ${FLOORS.find(f=>f.id===config.floor)?.label} laminate`,amount:null,value:DESIGNER});
 const electrics=electricalById(config.electrical);
 if(electrics.id!=='none')items.push({label:`Electrics · ${electrics.label}`,amount:null,value:DESIGNER});

 const explanation=base
  ?(base.startingOnly
   ?`Make Room publishes garden rooms from £9,980 installed. This is the range entry price, not a quote for this particular design${bifolds?', plus the published minimum bi-fold allowance':''}.`
   :`This starting planning figure uses Make Room’s January 2024 published size examples${bifolds?', plus the published minimum bi-fold allowance for each bi-fold door':''}. These examples are not a current rate card. Your designer prices the cladding, other glazing, overhangs, decking, flooring, electrics and site requirements individually.`)
  :(config.type==='extension'
   ?'Make Room prices modular extensions individually, so your design is saved for a tailored price from your designer.'
   :'Make Room prices projects individually. This design is larger than the published garden-room examples, so your designer will prepare a tailored price.');
 return {
  config,total,
  priceLabel:base?(base.startingOnly?'Published range starting price':'Published-guide planning estimate'):'Your tailored Make Room price',
  priceNote:base?(base.startingOnly?'Including VAT · published range starting price · not a quote for this design':'Including VAT · January 2024 examples · selected options and site costs priced separately'):'Your design is saved for individual pricing by Make Room.',
  explanation,items,reference,designReference,createdAt,currency:'GBP',taxRate:20,isStartingEstimate:!!base,
  basisType:base?.startingOnly?'published-starting-price':base?'published-example-interpolation':'specialist-only',
  sourceUrl:base?.sourceUrl||GUIDE_SOURCE,sourcePublishedAt:base?.startingOnly?null:GUIDE_PUBLISHED_AT,
  allowances:bifolds?[{label:'Bi-fold upgrade, published minimum',each:BIFOLD_ALLOWANCE,count:bifolds,sourceUrl:GUIDE_SOURCE,sourcePublishedAt:GUIDE_PUBLISHED_AT}]:[],
  scope,exclusions,summary:summaryRows(config),
 };
}
