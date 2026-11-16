(function attachForecastDisplayPreferences(root) {
  'use strict';
  const legacyKey='ffs.ui.forecastDollarBasis';
  const plansKey='ffs.ui.forecastDollarBasisPlans.v1';
  const valid=value=>value==='today'||value==='future';
  const identity=(plan,id)=>JSON.stringify([id||plan?.meta?.planId||'personal',plan?.meta?.updatedAt||'']);
  function create(storage) {
    let plans={};
    try {const value=JSON.parse(storage.getItem(plansKey)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))plans=value;}catch{}
    let active=null,basis='today';
    const persist=()=>{try{storage.setItem(plansKey,JSON.stringify(plans));}catch{}};
    const legacy=()=>{try{const value=storage.getItem(legacyKey);return valid(value)?value:'today';}catch{return 'today';}};
    function markNew(key){plans[key]='today';if(active===key)basis='today';persist();}
    function activate(key,{newPlan=false}={}){
      if(newPlan)markNew(key);
      if(active===key)return basis;
      active=key;
      basis=Object.hasOwn(plans,key)&&valid(plans[key])?plans[key]:legacy();
      plans[key]=basis;persist();
      return basis;
    }
    function choose(value){
      if(!valid(value))return;
      basis=value;
      if(active!==null){plans[active]=value;persist();}
      // Only an explicit control selection writes the existing global preference.
      try{storage.setItem(legacyKey,value);}catch{}
    }
    return {activate,markNew,choose,get basis(){return basis;}};
  }
  root.FFSForecastDisplayPreferences={create,identity,legacyKey,plansKey};
})(typeof window==='undefined'?globalThis:window);
