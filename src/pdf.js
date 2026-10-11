import {jsPDF} from 'jspdf';
import qrcode from 'qrcode-generator';
import {summaryRows,CLADDINGS,DOORS,ELECTRICAL,USES,finish,designCode} from './catalog.js';

const GREEN=[82,111,65],DARK=[37,48,36],MUTED=[91,101,86],PALE=[238,242,233],STONE=[233,230,224];
const VISIT='https://www.makeroomoutside.co.uk/our-show-villages/halifax/';
const DESIGN_ORIGIN='https://make-room-configurator.netlify.app/configurator/';
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);

// Bound raster assets before embedding. Logo remains lossless; photography is JPEG.
async function imageData(src,lossless=false){
  return new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{
      const canvas=document.createElement('canvas'),scale=Math.min(lossless?3:1,1400/image.naturalWidth);
      canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
      const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      resolve(canvas.toDataURL(lossless?'image/png':'image/jpeg',.84));
    };
    image.onerror=()=>resolve(null);image.src=src;
  });
}

export async function buildDesignPack(quote,images={}){
  const c=quote.config,doc=new jsPDF({unit:'mm',format:'a4',compress:true}),logo=await imageData('/assets/make-room-logo.svg',true),photo=await imageData('/assets/real-room.webp');
  const designUrl=`${DESIGN_ORIGIN}?design=${designCode(c)}`,door=DOORS.find(item=>item.id===c.doors),date=new Date(quote.createdAt||Date.now()).toLocaleDateString('en-GB');
  let page=1;
  doc.setProperties({title:`Your Make Room garden room | ${quote.reference}`,subject:'Personal garden room design and planning estimate',author:'Make Room Outside Living',creator:'Make Room Garden Room Designer'});
  const rect=(x,y,w,h,color)=>{doc.setFillColor(...color);doc.rect(x,y,w,h,'F');};
  function text(t,x,y,size=10,color=DARK,bold=false,max=170){doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);const lines=doc.splitTextToSize(String(t),max);doc.text(lines,x,y);return y+lines.length*size*.43;}
  function line(y){doc.setDrawColor(...STONE);doc.setLineWidth(.3);doc.line(18,y,192,y);}
  function link(label,x,y,url,size=8,max=170){text(label,x,y,size,GREEN,true,max);doc.link(x,y-size*.38,Math.min(max,doc.getTextWidth(label)),size*.55+1.5,{url});}

  // Contain every configured view: never stretch a room, opening or measured plan.
  // Reference photography may crop to a frame where no geometry is asserted.
  function img(data,x,y,w,h,{crop=false,background=PALE}={}){
    if(!data)return false;
    try{
      const info=doc.getImageProperties(data),scale=crop?Math.max(w/info.width,h/info.height):Math.min(w/info.width,h/info.height),iw=info.width*scale,ih=info.height*scale;
      rect(x,y,w,h,background);doc.saveGraphicsState();doc.rect(x,y,w,h);doc.clip();doc.discardPath();
      doc.addImage(data,info.fileType||'JPEG',x+(w-iw)/2,y+(h-ih)/2,iw,ih,undefined,'FAST');doc.restoreGraphicsState();return true;
    }catch{return false;}
  }
  function qr(x,y,size){
    const code=qrcode(0,'M');code.addData(designUrl);code.make();const count=code.getModuleCount(),unit=size/(count+8);
    rect(x,y,size,size,[255,255,255]);doc.setFillColor(...DARK);
    for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(code.isDark(row,col))doc.rect(x+(col+4)*unit,y+(row+4)*unit,unit+.002,unit+.002,'F');
    doc.link(x,y,size,size,{url:designUrl});
  }
  function header(){rect(0,0,210,297,[255,255,255]);if(logo)img(logo,18,13,31,22,{background:[255,255,255]});text('Your personal garden room design',88,23,8,MUTED,false,104);text(`Prepared ${date}`,88,31,7,MUTED,false,104);line(41);}
  function footer(){
    link('Reopen your saved design',18,273,designUrl,7.5,80);link('Talk it through. Plan a visit.',128,273,VISIT,7.5,64);
    line(279);text('MAKE ROOM OUTSIDE LIVING',18,286,7,GREEN,true);text(quote.reference,99,286,7,MUTED,false,70);text(`${page} / 7`,180,286,7,MUTED,false,15);
  }
  const newPage=()=>{footer();doc.addPage();page++;header();};
  function title(t,sub){text(t,18,58,25,GREEN,false,174);if(sub)text(sub,18,72,10,MUTED,false,171);}
  function note(t,y){doc.setFontSize(9);const h=Math.max(18,doc.splitTextToSize(t,161).length*4+10);rect(18,y,174,h,PALE);text(t,24,y+8,9,MUTED,false,161);}
  function list(items,y,size=10,max=165){for(const item of items){rect(18,y-2,1.8,1.8,GREEN);y=text(item,24,y,size,DARK,false,max)+5;}return y;}
  function rgb(hex){const clean=hex.replace('#','');return[0,2,4].map(index=>parseInt(clean.slice(index,index+2),16));}
  function frontDiagram(x,y,w,h){
    rect(x,y,w,h,PALE);const scale=Math.min((w-14)/c.width,(h-12)/2.5),rw=c.width*scale,rh=2.5*scale,left=x+(w-rw)/2,top=y+(h-rh)/2;
    rect(left,top,rw,rh,rgb(finish(c).color));rect(left-1,top-1,rw+2,2.5,DARK);rect(left,top+rh-1.5,rw,1.5,MUTED);
    const dw=door.openingWidth*scale,dh=2.06*scale,dx=left+(rw-dw)/2,dy=top+rh-dh-1.5;rect(dx,dy,dw,dh,[182,198,190]);
    doc.setDrawColor(...DARK);doc.setLineWidth(.8);doc.rect(dx,dy,dw,dh);const panes=c.doors==='bifold'?3:c.doors==='single'?1:2;for(let i=1;i<panes;i++)doc.line(dx+dw*i/panes,dy,dx+dw*i/panes,dy+dh);
    text('Schematic elevation',x+4,y+h-2,6.5,MUTED,false,w-8);
  }
  function planDiagram(x,y,w,h){
    rect(x,y,w,h,PALE);const scale=Math.min((w-26)/c.width,(h-24)/c.depth),rw=c.width*scale,rd=c.depth*scale,left=x+(w-rw)/2,top=y+(h-rd)/2;
    rect(left,top,rw,rd,[215,208,186]);doc.setDrawColor(...DARK);doc.setLineWidth(1.4);doc.rect(left,top,rw,rd);
    const opening=door.openingWidth*scale;rect(left+(rw-opening)/2,top+rd-1,opening,2,PALE);doc.setLineWidth(.5);doc.line(left+(rw-opening)/2,top+rd,left+(rw+opening)/2,top+rd);
    text(`${c.width}m`,left+rw/2-6,top-4,8,GREEN);text(`${c.depth}m`,left+rw+3,top+rd/2,8,GREEN);text('D1',left+rw/2-3,top+rd+7,7,GREEN);
    text('Schematic layout; exact openings and interior to be agreed.',x+4,y+h-2,6.5,MUTED,false,w-8);
  }

  // 1 / Personal cover, configured room and useful next action.
  header();text('Make room for',18,62,31,DARK);text('your kind of living.',18,77,31,GREEN);text(`${USES.find(item=>item.id===c.use)?.label}  |  ${c.width}m x ${c.depth}m`,18,91,12,MUTED);
  img(images.hero||images.perspective||photo,0,107,210,112,{crop:!images.hero&&!images.perspective});
  if(!images.hero&&!images.perspective)text('A completed Make Room room for inspiration.',18,225,7,MUTED);
  rect(18,230,174,34,PALE);text('Designed by you. Built around your life.',24,240,13,GREEN);text(`External footprint ${(c.width*c.depth).toFixed(1)} m2  |  Standard height 2.5m`,24,250,10,DARK);
  link('Keep your design.',24,258,designUrl,9,70);link('Plan your visit.',105,258,VISIT,9,75);

  // 2 / Honest price basis, selected allowances and explicitly unpriced work.
  newPage();title('A clear starting point.','Your design summary and personal planning estimate.');
  rect(18,84,174,47,PALE);text(quote.priceLabel||'Your planning estimate',25,94,10,GREEN);text(quote.total?money(quote.total):'Tailored specialist quote',25,111,quote.total?31:23,GREEN);text(quote.priceNote||'Subject to site survey and final specification.',25,122,8,MUTED,false,160);
  let y=text(quote.explanation||'Make Room will review your design and confirm the final price after a site assessment.',18,142,9,MUTED,false,174)+5;
  for(const item of quote.items||[]){text(item.label,18,y,8.2,DARK,false,115);text(item.amount?money(item.amount):item.value||'To be confirmed',140,y,8.2,DARK,false,52);line(y+3);y+=9;}
  const lower=Math.max(219,y+3);
  text('What the guide covers',18,lower,11,GREEN,false,83);text(quote.scope||'A starting guide for the room footprint. Make Room confirms the complete specification, access and preparation.',18,lower+8,8,MUTED,false,82);
  text('To confirm separately',110,lower,11,GREEN,false,82);let ey=lower+8;
  for(const item of quote.exclusions||['Chosen upgrades and bespoke glazing','Ground preparation, foundations and access','Connection to your home electrical supply']){rect(110,ey-1.8,1,1,GREEN);ey=text(item,114,ey,7.6,MUTED,false,77)+2;}
  const dated=quote.sourcePublishedAt||quote.sourceUrl?.includes('how-much-is-a-garden-room');
  link(dated?'Source: 9 January 2024 price examples':'Source: published range starting price',18,251,quote.sourceUrl||VISIT,7.3,84);
  text(dated?'Published examples are not a current rate card. Selected options, site costs and current pricing require a new written quotation.':'The range entry price is not a quotation for this selected design. Make Room must confirm current pricing and the full project scope.',18,258,7.2,MUTED,false,82);

  // 3 / A visual story, including a real front elevation and the interior.
  newPage();title('Your room, in perspective.','See how your choices work together, from the outside and within.');
  img(images.perspective||photo,18,83,174,78,{crop:!images.perspective});text('Your chosen exterior',18,169,12,GREEN);text(`${CLADDINGS.find(item=>item.id===c.cladding)?.label} cladding. ${finish(c).label} finish.`,18,176,9,MUTED);
  if(!img(images.front,18,185,83,54))frontDiagram(18,185,83,54);
  img(images.inside||images.interior||photo,109,185,83,54,{crop:!images.inside&&!images.interior});
  text('FRONT ELEVATION',18,246,8,GREEN,true,83);text('INSIDE YOUR ROOM',109,246,8,GREEN,true,83);
  text(`D1: ${door.label}, ${door.openingWidth.toFixed(2)}m catalogue opening width.`,18,253,8,MUTED,false,83);
  text('Furniture and garden are illustrative, and are not included in your selected specification.',109,253,8,MUTED,false,83);
  text('Views illustrate your design; they are not manufacturing drawings or finish samples.',18,266,7,MUTED,false,174);

  // 4 / Measured plan and an opening schedule with verified door dimensions.
  newPage();title('Find your fit.','A dimensioned plan to help you picture your room in your garden.');
  if(!img(images.plan,18,86,174,109))planDiagram(18,86,174,109);
  rect(18,202,174,24,PALE);text('WIDTH',25,210,8,MUTED);text(`${c.width}m`,25,220,16,GREEN);text('DEPTH',82,210,8,MUTED);text(`${c.depth}m`,82,220,16,GREEN);text('FOOTPRINT',139,210,8,MUTED);text(`${(c.width*c.depth).toFixed(1)} m2`,139,220,16,GREEN);
  text('Your opening schedule',18,239,12,GREEN);text(`D1  ${door.label}  |  ${door.openingWidth.toFixed(2)}m catalogue opening width`,18,248,8.5,DARK,false,174);
  text(`Side glazing: ${c.windows==='none'?'not selected':c.windows==='both'?'left and right sides':'the '+c.windows+' side'} (viewed from the garden). Exact apertures and final positions to be agreed.`,18,256,8,MUTED,false,174);
  text('External dimensions shown. Internal usable space is smaller. Allow installation and maintenance clearance. Schematic design, not a construction drawing.',18,266,7,MUTED,false,174);

  // 5 / Complete saved specification; no private customer contact details.
  newPage();title('Every choice, in one place.','Your selected specification, ready for a conversation with Make Room.');
  y=86;for(const[key,value]of summaryRows(c)){text(key,18,y,9,MUTED);text(value,92,y,10,DARK,false,100);line(y+4);y+=12;}
  text('This saved design contains your choices only. Reopening it does not share your contact details or grant another person access to your estimate.',18,264,7,MUTED,false,174);

  // 6 / Everyday comfort, clear scope and specification reminders.
  newPage();title('Made for everyday comfort.','Your selected electrical package and the practical details to confirm.');
  text(`${ELECTRICAL.find(item=>item.id===c.electrical)?.label} electrical package`,18,88,15,GREEN);y=list(ELECTRICAL.find(item=>item.id===c.electrical)?.items||[],101,9);line(y);y+=10;
  text('Bring the garden into the room.',18,y,15,GREEN);y+=11;y=text('Your selected doors and side windows create the starting point for natural light and garden views. Your design specialist will check compatible opening sizes, placement and installation clearances.',18,y,9,MUTED,false,174)+10;
  text('The details that make it yours',18,y,15,GREEN);y+=10;list([`Flooring: ${summaryRows(c).find(item=>item[0]==='Flooring')?.[1]}`,`Roof overhang: ${c.overhang.length?c.overhang.join(', '):'not selected'}`,`Decking: ${c.decking.length?c.decking.join(', '):'not selected'}`],y,9);
  note('Supply connection, furniture and decorative accessories are not part of the illustrated design. Colours and natural materials can vary from the screen preview.',242);

  // 7 / Practical next step and a scannable design-only return route.
  newPage();title('Let’s make room.','A useful checklist for your next conversation, and a place to experience it.');
  text('Before we finalise your room',18,90,15,GREEN);list(['Measure your available space and note nearby trees, fences and boundaries.','Take a few photos of the garden, route from the road and access points.','Think about how your room will be used, now and in the future.','Discuss the base, ground preparation and electrical connection.','Ask your specialist to check planning and building regulation requirements.'],104);
  rect(18,198,174,66,PALE);text('Visit the Halifax Show Village',25,211,16,GREEN,false,117);text('Wakefield Road, Copley, Halifax HX3 0UA',25,222,9,DARK,false,113);link('01422 580172',25,234,'tel:01422580172',13,85);link('halifax@makeroomoutside.co.uk',25,245,'mailto:halifax@makeroomoutside.co.uk',9,113);link('Plan your visit',25,257,VISIT,9,104);
  qr(149,214,38);link('Scan to reopen your design',147,258,designUrl,6.7,44);footer();
  return doc.output('blob');
}
