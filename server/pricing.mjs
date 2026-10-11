import {createHash} from 'node:crypto';
import {normalizeConfig,CLADDINGS,ELECTRICAL,finish,summaryRows} from '../src/catalog.js';

// Published illustrations are a planning guide, never a Make Room tariff.
// Keep all amounts server-side so that the browser cannot reveal them before a saved enquiry.
export const GUIDE_SOURCE='https://www.makeroomoutside.co.uk/news-media/how-much-is-a-garden-room/';
export const GUIDE_PUBLISHED_AT='2024-01-09';
export const START_SOURCE='https://www.makeroomoutside.co.uk/products/garden-rooms/';
export const PUBLISHED_GUIDE=Object.freeze([[7.5,11500],[9,13500],[12,16500],[15,20000],[18,23000],[20,23500],[24,26000]]);
const round=value=>Math.round(value/100)*100;
export function publishedBase(area){
 if(area<7.5)return {amount:9980,basis:'Published garden-room starting price',sourceUrl:START_SOURCE,startingOnly:true};
 if(area>24)return null;
 for(let i=1;i<PUBLISHED_GUIDE.length;i++){
  const [a,p]=PUBLISHED_GUIDE[i-1],[b,q]=PUBLISHED_GUIDE[i];
  if(area<=b)return {amount:round(p+(q-p)*(area-a)/(b-a)),basis:'Size guide from published examples',sourceUrl:GUIDE_SOURCE,startingOnly:false};
 }
 return null;
}
export function calculateQuote(input,{reference='MR-DESIGN',createdAt=new Date().toISOString(),mode=process.env.MAKE_ROOM_PRICING_MODE||'published-guide'}={}){
 const config=normalizeConfig(input),area=Number((config.width*config.depth).toFixed(4));
 const designReference='MR-'+createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0,12).toUpperCase();
 const base=mode==='quote-only'||config.type==='extension'?null:publishedBase(area);
 const scope='Published illustrations for a garden-room build. The final specification, site access, preparation and location are priced by Make Room.';
 const exclusions=['Exact cladding selection and colour','Extra or alternative glazing and door specification','Electrical package upgrades and mains connection','Selected decking and roof overhangs','Additional site work, access and delivery requirements','Decoration, planning and any bespoke work'];
 const items=[];
 let total=null;
 if(base){
  items.push({label:base.basis,amount:base.amount,note:base.startingOnly?'An entry price for the range; not a price for this particular small design.':'Area interpolation between published example prices; specification may differ.'});
  total=base.amount;
  if(config.doors==='bifold'){
   items.push({label:'Bi-fold upgrade, published starting allowance',amount:3500,note:'Make Room publishes an additional £3,500+; actual size and finish may cost more.'});
   total+=3500;
  }
 }
 items.push({label:`${CLADDINGS.find(x=>x.id===config.cladding)?.label} · ${finish(config)?.label}`,amount:null,value:'Priced by specialist'});
 if(config.doors!=='bifold')items.push({label:'Selected door & window specification',amount:null,value:'Priced by specialist'});
 items.push({label:`${ELECTRICAL.find(x=>x.id===config.electrical)?.label} electrical package`,amount:null,value:'Priced by specialist'});
 if(config.overhang.length)items.push({label:`Roof overhang · ${config.overhang.join(', ')}`,amount:null,value:'Priced by specialist'});
 if(config.decking.length)items.push({label:`Decking · ${config.decking.join(', ')}`,amount:null,value:'Priced by specialist'});
 return {config,total,priceLabel:base?(base.startingOnly?'Published range starting price':'Published-guide planning estimate'):'Your tailored Make Room price',priceNote:base?(base.startingOnly?'Including VAT · published range starting price · not a quote for this design':'Including VAT · January 2024 examples · selected options and site costs priced separately'):'Your design is saved for individual pricing by Make Room.',explanation:base?(base.startingOnly?'Make Room publishes garden rooms from £9,980 installed. This is the range entry price, not a quote for this particular design.':'This starting planning figure uses Make Room’s January 2024 published size examples, plus the published minimum bi-fold allowance where selected. These examples are not a current rate card. Your cladding, glazing, electrics, decking and site requirements still need individual pricing.'):'Make Room prices projects individually. This design needs a tailored price because its size or building type is outside the published garden-room examples.',items,reference,designReference,createdAt,currency:'GBP',taxRate:20,isStartingEstimate:!!base,basisType:base?.startingOnly?'published-starting-price':base?'published-example-interpolation':'specialist-only',sourceUrl:base?.sourceUrl||GUIDE_SOURCE,sourcePublishedAt:base?.startingOnly?null:GUIDE_PUBLISHED_AT,scope,exclusions,summary:summaryRows(config)};
}
