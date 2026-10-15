import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseUkPhone,validateName,validateEmail,validatePostcode,INSTALL_TIMES,BUDGETS,BEST_TIMES,REQUEST_TOPICS} from '../src/validation.js';

test('UK mobiles and landlines normalise from every common written form',()=>{
 const mobile={ok:true,national:'07912 345678',e164:'+447912345678',kind:'mobile'};
 for(const input of ['07912345678','07912 345678','07912-345-678','07912.345.678','+447912345678','+44 7912 345678','+44 (0)7912 345678','+44 (0) 7912 345678','0044 7912 345678','44 7912 345678','+44 07912 345678',' 07912 345678 '])
  assert.deepEqual(normaliseUkPhone(input),mobile,input);
 assert.deepEqual(normaliseUkPhone('07624 123456'),{ok:true,national:'07624 123456',e164:'+447624123456',kind:'mobile'});
 assert.deepEqual(normaliseUkPhone('(01422) 580172'),{ok:true,national:'01422 580172',e164:'+441422580172',kind:'landline'});
 assert.deepEqual(normaliseUkPhone('+44 1422 580172'),{ok:true,national:'01422 580172',e164:'+441422580172',kind:'landline'});
 assert.equal(normaliseUkPhone('02071234567').national,'020 7123 4567');
 assert.equal(normaliseUkPhone('02920 123456').national,'029 2012 3456');
 assert.equal(normaliseUkPhone('01132456789').national,'0113 245 6789');
 assert.equal(normaliseUkPhone('0121 234 5678').national,'0121 234 5678');
 assert.equal(normaliseUkPhone('0191 234 5678').national,'0191 234 5678');
 assert.deepEqual(normaliseUkPhone('0300 123 4567'),{ok:true,national:'0300 123 4567',e164:'+443001234567',kind:'non-geographic'});
});

test('drama, premium, personal, pager and repeated-digit numbers are refused',()=>{
 const sample='That looks like a sample number. Please enter your own UK phone number.';
 for(const n of ['07700 900000','07700 900123','07700900999','+44 7700 900456','01632 960000','01632 960999','020 7946 0000','020 7946 0999','0113 496 0000','0114 496 0123','0115 496 0123','0116 496 0123','0117 496 0123','0118 496 0999','0121 496 0000','0131 496 0123','0141 496 0123','0151 496 0123','0161 496 0999','028 9649 6000','028 9649 6999','029 2018 0000','029 2018 0999','0191 498 0000','0191 498 0999','0306 999 0000','0306 999 0999','0808 157 0000','0808 157 0999','0909 879 0000','0909 879 0999'])
  assert.deepEqual(normaliseUkPhone(n),{ok:false,national:'',e164:'',kind:null,error:sample},n);
 // Just outside the reserved blocks are ordinary numbers.
 assert.equal(normaliseUkPhone('07700 901000').ok,true);
 assert.equal(normaliseUkPhone('0121 496 1000').ok,true);
 assert.equal(normaliseUkPhone('028 9649 7000').ok,true);
 for(const n of ['0800 123 4567','0845 123 4567','0870 123 4567','0909 123 4567','0906 123 4567','07012 345678','07612 345678','04123 456789','05123 456789','+1 212 555 0100','+353 1 234 5678','07912 34567','07912 3456789','0791234567x','phone me','0','12345']){
  const r=normaliseUkPhone(n);assert.equal(r.ok,false,n);assert.match(r.error,/UK mobile or landline number, e\.g\. 07xxx xxxxxx/,n);assert.doesNotMatch(r.error,/900123/);
 }
 for(const n of ['07777777777','07777 777777','01111111111','02222222222'])assert.equal(normaliseUkPhone(n).ok,false,n);
 assert.equal(normaliseUkPhone('').error,'Please enter your phone number.');
 assert.equal(normaliseUkPhone(undefined).ok,false);
 assert.equal(normaliseUkPhone({}).ok,false);
});

test('names allow any letters, spaces, hyphens, apostrophes and full stops only',()=>{
 assert.deepEqual(validateName('  Zoë ','first name'),{ok:true,value:'Zoë'});
 assert.deepEqual(validateName("Siân  O'Brien-Jones",'last name'),{ok:true,value:"Siân O'Brien-Jones"});
 assert.equal(validateName('O’Neill','last name').ok,true);
 assert.equal(validateName('J. R.','first name').ok,true);
 assert.equal(validateName('Łukasz','first name').ok,true);
 assert.equal(validateName('','first name').error,'Please enter your first name.');
 for(const bad of ['123','Jo3','<script>','a@b','...','-',"'",'x'.repeat(51)])assert.equal(validateName(bad,'first name').ok,false,bad);
 assert.equal(validateName('x'.repeat(50),'first name').ok,true);
});

test('email and postcode are normalised for storage',()=>{
 assert.deepEqual(validateEmail(' QA@Example.COM '),{ok:true,value:'qa@example.com'});
 for(const bad of ['broken','a@b','a@@b.com','a b@c.com','<a@b.com>',''])assert.equal(validateEmail(bad).ok,false,bad);
 assert.deepEqual(validatePostcode('hx30ua'),{ok:true,value:'HX3 0UA'});
 assert.deepEqual(validatePostcode(' sw1a 1aa '),{ok:true,value:'SW1A 1AA'});
 for(const bad of ['NONE','12345','HX3','QX1 1AA',''])assert.equal(validatePostcode(bad).ok,false,bad);
});

test('option lists mirror the Make Room enquiry form',()=>{
 assert.deepEqual(INSTALL_TIMES,['As soon as possible','3–6 months','6–12 months','Just exploring for now']);
 assert.deepEqual(BUDGETS,['£10,000 – £20,000','£20,000 – £35,000','£35,000+']);
 assert.equal(BEST_TIMES.length,4);
 assert.deepEqual(Object.keys(REQUEST_TOPICS),['callback','book-call','visit','brochure']);
});
