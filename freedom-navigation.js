(function attachFreedomNavigation(root) {
  'use strict';
  const sections = Object.freeze([
    {view:'dashboard',hash:'progress',label:'My Freedom Progress',subtitle:'Where am I now, and how close am I to financial freedom?'},
    {view:'semiretirement',hash:'future',label:'Explore My Future',subtitle:'Compare growth scenarios, retirement ages and lifestyle options.'},
    {view:'decision',hash:'change',label:'Try a Change',subtitle:'See how investing more, spending less or working differently changes my future.'},
    {view:'weeklyplan',hash:'weekly',label:'My Weekly Mission',subtitle:'Know what to do with my money this week.'},
  ]);
  const hashes = Object.freeze({dashboard:'progress',semiretirement:'future',decision:'change',weeklyplan:'weekly',setup:'plan',assumptions:'assumptions',investments:'investments',super:'super',goals:'goals',scenarios:'scenarios',reports:'reports',progress:'financial-history'});
  function routeFromHash(hash) {
    const value=String(hash || '').replace(/^#/,'');
    if(value==='future-growth')return {view:'semiretirement',future:'growth'};
    const view=Object.keys(hashes).find(key=>hashes[key]===value);
    return view ? {view,future:'retirement'} : null;
  }
  function mount(document,{getContext,navigate,hasSavedPlan}) {
    let mode='welcome',future='retirement',started=false,restoring=false,defaultMoreApplied=false;
    let welcomeSaved=getContext().returning;
    const home=document.getElementById('homeView'),workspace=document.getElementById('appWorkspace');
    const futureView=document.querySelector('[data-view-panel="semiretirement"]');
    const growth=document.querySelector('.growth-workspace');
    // The editor rebuilds its header. Resolve the live header when restoring
    // this same comparison node rather than keeping an anchor in old markup.
    const controls=document.createElement('div');controls.className='freedom-future-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Explore your future');
    for(const [value,label] of [['retirement','Retirement & lifestyle'],['growth','Growth scenarios']]){
      const button=document.createElement('button');button.type='button';button.className='btn';button.dataset.freedomFuture=value;button.textContent=label;controls.append(button);
      button.addEventListener('click',()=>{future=value;sync();if(value==='growth')openGrowth();record('semiretirement');});
    }
    const note=document.createElement('p');note.className='freedom-model-note';note.textContent='Growth comparisons use the existing Financial Plan forecast and saved assumptions. Retirement uses the timing and adjustments shown in its dedicated projection. The views can use different projection rules: review each view’s assumptions. Their results are displayed separately and are never added together. Saved snapshots retain their own historical results.';
    const host=document.createElement('div');host.className='freedom-growth-host';host.id='freedomGrowthHost';
    futureView.querySelector('.section-heading').after(controls,note,host);
    function openGrowth(){const trigger=growth.querySelector('[data-growth-open]');if(trigger.getAttribute('aria-expanded')!=='true')trigger.click();}
    function record(view,replace=false,keepPolicy=false){
      if(!started||restoring)return;
      const hash=view==='welcome'?'':`#${view==='semiretirement'&&future==='growth'?'future-growth':hashes[view]}`;
      const state={...root.history.state,ffsWorkspace:view,ffsFuture:future};
      if(!replace&&root.location.hash===hash&&root.history.state?.ffsWorkspace===view)return;
      root.history[replace?'replaceState':'pushState'](state,'',keepPolicy?root.location.href:root.location.pathname+root.location.search+hash);
    }
    function neutralise(){
      // Change primary presentation text only. Keep provider disclosures, stored
      // insight reports and the underlying Insights action untouched.
      for(const node of document.querySelectorAll('#homeView .engagement-placeholder-card strong,#homeView .engagement-ai-card .metric-label,#homeView .engagement-ai-card h3,[data-view-panel="dashboard"] .dashboard-ai-card .metric-label,[data-view-panel="dashboard"] .dashboard-ai-card h3')){
        if(/AI Coach|AI coaching|AI Coaching/i.test(node.textContent))node.textContent='Insights';
      }
      for(const card of document.querySelectorAll('#homeView .engagement-placeholder-card')){
        if(card.querySelector('.engagement-placeholder-icon')?.textContent==='AI'){
          card.querySelector('.engagement-placeholder-icon').textContent='Insights';
          const p=card.querySelector('p');if(p)p.textContent='Optional insights are available through More tools. Your financial calculations work independently.';
        }
      }
    }
    function sync(){
      const context=getContext();
      document.body.dataset.freedomStage=mode;document.body.dataset.freedomFuture=future;document.body.dataset.freedomSample=String(context.isDemo);
      home.classList.toggle('hidden',mode!=='welcome');workspace.classList.toggle('hidden',mode==='welcome');
      if(mode==='welcome'){document.getElementById('introSampleActions').classList.remove('hidden');document.getElementById('continuePanel').classList.toggle('hidden',!welcomeSaved);}
      sections.forEach(section=>{
        const heading=document.querySelector(`[data-view-panel="${section.view}"] > .section-heading`);
        if(heading){heading.querySelector('h2').textContent=section.label;heading.querySelector('p').textContent=section.subtitle;}
      });
      const sampleSummary=document.querySelector('[data-s3-key="sample"] > summary');if(sampleSummary)sampleSummary.textContent='Explore a Sample Plan';
      document.querySelector('#heroSamplePlanMenu > summary').textContent='Explore a Sample Plan';
      document.getElementById('heroDemoButton').textContent='Open selected sample';
      document.getElementById('samplePlanSummary').textContent='Sample plans contain fictional information. Enter your own household information to produce personalised projections.';
      const next=home.querySelector('#introSampleActions > .s3-scope');if(next)next.textContent='Enter your household information, then review your personalised financial freedom journey.';
      const cue=document.getElementById('s3CurrentScreen');if(cue)cue.textContent=`${context.isDemo?'Fictional sample · ':''}${document.querySelector(`.workspace-nav [data-view="${context.view}"] span`)?.textContent || document.querySelector(`[data-view-panel="${context.view}"] > .section-heading h2`)?.textContent || 'Your workspace'}`;
      const more=document.getElementById('moreNavigation');
      if(!defaultMoreApplied&&cue){defaultMoreApplied=true;try{if(localStorage.getItem('ffs.ui.moreNavigationOpen')===null)more.open=false;}catch{more.open=false;}}
      controls.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.freedomFuture===future)));
      const showGrowth=mode==='workspace'&&context.view==='semiretirement'&&future==='growth';
      host.hidden=!showGrowth;
      if(showGrowth){if(growth.parentElement!==host)host.append(growth);}else {const header=document.querySelector('#forecastAssumptionsWorkspace .fa-header');if(header&&growth.parentElement!==header)header.append(growth);}
      neutralise();
    }
    function onView(view){mode='workspace';sync();record(view);}
    function retirement(){future='retirement';}
    function follow(route){
      restoring=true;
      try{
        if(!route||route.view==='welcome'){welcomeSaved=hasSavedPlan();mode='welcome';sync();home.scrollIntoView({block:'start',behavior:'instant'});}
        else {future=route.future || 'retirement';navigate(route.view);if(future==='growth')openGrowth();}
      }finally{restoring=false;}
    }
    document.getElementById('headerHomeLink')?.addEventListener('click',event=>{
      // Navigate in place so the user's current plan stays loaded and unchanged.
      event.preventDefault();
      follow({view:'welcome'});
      record('welcome');
    });
    root.addEventListener('popstate',()=>{
      if(['#privacy','#terms'].includes(root.location.hash))return;
      const route=routeFromHash(root.location.hash);follow(route || {view:'welcome'});
    });
    root.addEventListener('hashchange',()=>{
      const route=routeFromHash(root.location.hash);
      if(route&&(getContext().view!==route.view||mode!=='workspace'||future!==route.future))follow(route);
    });
    new MutationObserver(()=>sync()).observe(document.getElementById('forecastAssumptionsWorkspace'),{childList:true});
    function start(){
      started=true;
      const policy=['#privacy','#terms'].includes(root.location.hash);
      // Always open on the welcome page, even when a saved plan exists.
      // The existing Continue, Start My Plan and sample actions remain available.
      welcomeSaved=hasSavedPlan();
      mode='welcome';sync();record('welcome',true,policy);
    }
    return {sync,onView,retirement,start,get restoring(){return restoring;}};
  }
  root.FFSFreedomNavigation={sections,routeFromHash,mount};
})(typeof window==='undefined'?globalThis:window);
