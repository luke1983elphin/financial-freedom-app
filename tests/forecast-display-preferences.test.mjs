import test from 'node:test';
import assert from 'node:assert/strict';
import '../forecast-display-preferences.js';
const api=globalThis.FFSForecastDisplayPreferences;
function backend(initial={}){const data=new Map(Object.entries(initial));return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
test('a genuinely new plan defaults to Today without overwriting an explicit legacy preference',()=>{
 const store=backend({[api.legacyKey]:'future','financial-record':'nominal amounts'}),p=api.create(store);
 assert.equal(p.activate('new',{newPlan:true}),'today');assert.equal(store.getItem(api.legacyKey),'future');assert.equal(store.getItem('financial-record'),'nominal amounts');
});
test('existing saved plans retain both legacy display selections',()=>{for(const value of ['today','future']){const store=backend({[api.legacyKey]:value});assert.equal(api.create(store).activate('existing'),value);assert.equal(store.getItem(api.legacyKey),value);}});
test('a new plan default survives a fresh browser session and preserves the earlier plan choice',()=>{
 const store=backend({[api.legacyKey]:'future'}),p=api.create(store);assert.equal(p.activate('old'),'future');p.markNew('new');assert.equal(p.activate('new'),'today');
 assert.equal(api.create(store).activate('new'),'today');assert.equal(api.create(store).activate('old'),'future');assert.equal(store.getItem(api.legacyKey),'future');
});
test('explicit selections, including selecting the active default, persist independently of financial data',()=>{
 const store=backend(),p=api.create(store);p.activate('new',{newPlan:true});p.choose('today');assert.equal(store.getItem(api.legacyKey),'today');p.choose('future');assert.equal(api.create(store).activate('new'),'future');p.choose('invalid');assert.equal(p.basis,'future');
});
test('corrupt UI preferences fail safely without deleting stored data',()=>{
 const store=backend({[api.plansKey]:'{broken',[api.legacyKey]:'future','financial-record':'unchanged'});assert.equal(api.create(store).activate('existing'),'future');assert.equal(store.getItem('financial-record'),'unchanged');
});
test('blocked storage permits session display switching',()=>{
 const p=api.create({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});assert.equal(p.activate('new',{newPlan:true}),'today');p.choose('future');assert.equal(p.activate('new'),'future');
});
test('preference identity uses existing metadata without changing the plan or schema',()=>{
 const plan={meta:{planId:'personal:1',updatedAt:'2026-11-16T00:00:00Z'},assets:{cash:1000}};const before=JSON.stringify(plan);assert.equal(api.identity(plan),JSON.stringify(['personal:1','2026-11-16T00:00:00Z']));assert.equal(JSON.stringify(plan),before);
});
