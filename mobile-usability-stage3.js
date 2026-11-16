(function attachMobileUsabilityStage3(root) {
  'use strict';
  // Presentation only: original nodes retain their IDs, values and listeners.
  function keyboardOpen(layoutHeight, visualHeight) {
    return Number.isFinite(visualHeight) && layoutHeight - visualHeight > 150;
  }
  function tidyInvestmentAssumptions(investing) {
    if (!investing) return;
    let action = investing.querySelector('[data-s3-assumptions]');
    // Remove legacy actions rather than merely hiding them. Keep the original
    // effective values and the annual investing input in their existing nodes.
    investing.querySelectorAll('[data-assumptions-open]').forEach(node => {
      if (node !== action) node.remove();
    });
    if (!action) {
      action = investing.ownerDocument.createElement('button');
      action.type = 'button';
      action.className = 'btn s3-assumptions-action';
      action.dataset.assumptionsOpen = '';
      action.dataset.s3Assumptions = '';
      action.textContent = 'Review forecast assumptions';
      investing.append(action);
    }
    action.hidden = false;
    investing.classList.add('s3-assumptions-summary');
  }
  function mount(document, context) {
    const mobile = root.matchMedia('(max-width: 760px)');
    const states = new Map();
    let identity;
    const all = selector => [...document.querySelectorAll(selector)];
    function remember() {
      if (!mobile.matches) return;
      all('details.s3-disclosure').forEach(node => states.set(node.dataset.s3Key, node.open));
    }
    function group(node, key, label, scope = '') {
      if (!node || !mobile.matches) return;
      if (node.parentElement?.dataset.s3Key === key) return node.parentElement;
      const details = document.createElement('details');
      details.className = 's3-disclosure'; details.dataset.s3Key = key;
      const summary = document.createElement('summary');summary.textContent = label;
      details.append(summary);
      if (scope) {const note = document.createElement('p');note.className='s3-scope';note.textContent=scope;details.append(note);}
      node.before(details);details.append(node);
      details.open = !mobile.matches || states.get(key) === true;
      details.addEventListener('toggle', () => {
        if (mobile.matches) states.set(key, details.open);
      });
      return details;
    }
    function sync() {
      const current = context();
      if (identity !== current.identity) {
        states.clear();identity=current.identity;
        all("details.s3-disclosure").forEach(n=>n.open=!mobile.matches);
      }
      const intro = document.getElementById('introSampleActions');
      if (intro && !document.getElementById('s3SampleChoices')) {
        const start = document.getElementById('heroStartButton');
        start.classList.add('btn-primary');
        const next = document.createElement('p');next.className='s3-scope';next.textContent='Start with your details, then review your personal forecast.';
        intro.prepend(start,next);
        const choices = document.createElement('div');choices.id='s3SampleChoices';
        // Move the existing selection and load actions; preserve all handlers.
        [...intro.children].filter(n=>n!==start&&n!==next).forEach(n=>choices.append(n));
        intro.append(choices);
        document.getElementById('samplePlanSummary').textContent='Fictional examples for exploring the app. These are not your personal finances.';
        document.getElementById('heroDemoButton').classList.remove('btn-primary');
        document.querySelector('#heroSamplePlanMenu > summary').classList.remove('btn-primary');

      }
      group(document.getElementById('s3SampleChoices'),'sample','Explore a fictional sample plan');
      const nav = document.querySelector('.workspace-nav');
      if (nav && !document.getElementById('s3CurrentScreen')) {
        const cue=document.createElement('p');cue.id='s3CurrentScreen';cue.className='s3-current-screen';nav.prepend(cue);
        const more=document.getElementById('moreNavigation');
        try {if(localStorage.getItem('ffs.ui.moreNavigationOpen')===null)more.open=!mobile.matches;}catch {more.open=!mobile.matches;}
      }
      const view=document.body.dataset.activeView;
      const active=document.querySelector(`.workspace-nav [data-view="${view}"]`);
      const cue=document.getElementById('s3CurrentScreen');
      if(cue)cue.textContent=`Current screen: ${active?.textContent.trim() || 'Home'}`;
      const basis=group(document.querySelector('.dollar-basis-control'),'dollars','Forecast values');
      if(basis)basis.firstElementChild.textContent=`Forecast values: ${document.querySelector('[data-dollar-basis][aria-pressed="true"]')?.textContent.trim() || 'choose dollars'}`;
      const investing=document.getElementById('investingForm');
      if(investing){
        tidyInvestmentAssumptions(investing);
        investing.parentElement.classList.add('s3-investment-settings');
        document.getElementById('investmentCards')?.parentElement.classList.add('s3-investment-results');
      }
      const goals=document.getElementById('personalForm');
      if(goals){
        goals.closest('.card').classList.add('s3-goal-overview');
        group(goals,'goals','Edit goals and contributions','Changes here update your current plan. Your saved retirement scenarios remain separate.');
      }
      group(document.getElementById('goalExamples'),'examples','Explore goal examples');
      group(document.getElementById('downsizingForm')?.parentElement,'downsizing','Optional downsizing strategy','Only included in your plan when you turn it on.');
      const superForm=document.getElementById('superForm');
      group(superForm?.parentElement,'super-inputs','Edit super contributions','Changes here update your current plan.');
      group(document.getElementById('employerSuperPanelMount'),'employer','Employer contribution details');
      group(document.getElementById('superSummary'),'super-tax','Contribution tax details');
      const superResults=document.getElementById('superCards')?.parentElement;
      superResults?.classList.add('s3-super-results');
      if(superResults&&current.superPosition){
        let position=document.getElementById('s3SuperPosition');
        if(!position){
          position=document.createElement('div');position.id='s3SuperPosition';position.className='s3-mobile-position';
          const label=document.createElement('p');label.textContent='Current super balance';
          const value=document.createElement('strong');
          const edit=document.createElement('button');edit.type='button';edit.className='btn';edit.textContent='Review contributions';
          edit.addEventListener('click',()=>{const details=document.querySelector('[data-s3-key="super-inputs"]');if(details){details.open=true;details.querySelector('summary').focus();details.scrollIntoView({block:'center',behavior:'smooth'});}});
          position.append(label,value,edit);superResults.prepend(position);
        }
        position.querySelector('strong').textContent=current.superPosition;
      }
      const retirement=document.querySelector('[data-semi-retirement-scenario]');
      if(retirement){
        [...retirement.children].filter(n=>n.classList.contains('semi-retirement-input-section')).forEach((section,index)=>{
          const title=section.querySelector('h4')?.textContent || 'Scenario settings';
          group(section,`retirement-${index}`,`Edit ${title.toLowerCase()}`,index===0&&!current.savedRetirement?'Timing changes update your current plan.':'Temporary scenario adjustments. Your current plan is unchanged; save a scenario to keep a separate snapshot.');
        });
        if(mobile.matches&&!retirement.querySelector('.s3-retirement-controls')){
          const controls=document.createElement('div');controls.className='s3-retirement-controls';
          const settings=[...retirement.children].filter(n=>n.matches('[data-s3-key^="retirement-"]'));
          if(settings.length){
            settings[0].before(controls);controls.append(...settings);
            const actions=retirement.querySelector(':scope > .planner-actions');if(actions)controls.append(actions);
            group(controls,'retirement-inputs','Review or edit retirement inputs',current.savedRetirement?'Separate saved scenario draft. Your current plan is unchanged.':'Timing updates your plan. Other adjustments are temporary until saved as a separate scenario.');
          }
        }
        if(current.savedRetirement){const note=retirement.querySelector('[data-s3-key="retirement-0"] .s3-scope');if(note)note.textContent='Editing a separate saved scenario draft. Your current plan and saved snapshot stay unchanged until you explicitly save a new scenario.';}
      }
      // Renderer refreshes must not hide errors or the field currently being edited.
      all('details.s3-disclosure').forEach(node=>{
        if(node.querySelector('[aria-invalid="true"],.field-error,.semi-retirement-error'))node.open=true;
      });
      updateViewport();
    }
    function updateViewport() {
      const footer=document.querySelector('.wizard-actions');
      const height=footer?.getBoundingClientRect().height || 0;
      document.documentElement.style.setProperty('--s3-wizard-footer-height',`${height}px`);
      document.body.classList.toggle('s3-keyboard-open',mobile.matches&&keyboardOpen(root.innerHeight,root.visualViewport?.height));
    }
    mobile.addEventListener('change',()=>{
      if (!mobile.matches) {
        all('details.s3-disclosure').reverse().forEach(n=>{
          const content=[...n.children].filter(child=>child.tagName!=='SUMMARY'&&!child.classList.contains('s3-scope'));
          n.replaceWith(...content);
        });
      }
      if(!mobile.matches)all('.s3-retirement-controls').forEach(n=>n.replaceWith(...n.children));
      sync();
    });
    function reveal(node) {
      let ancestor=node?.parentElement;
      while(ancestor){if(ancestor.matches('details'))ancestor.open=true;ancestor=ancestor.parentElement;}
    }
    document.addEventListener('invalid',event=>reveal(event.target),true);
    // Existing result actions must reveal their targets before the original
    // delegated handlers scroll and focus those same controls.
    document.addEventListener('click',event=>{
      const action=event.target.closest('[data-semi-action]')?.dataset.semiAction;
      if(action==='manage-one-off-lifestyle-events')reveal(document.querySelector('[data-one-off-lifestyle-spending]'));
      if(action==='edit-inputs')reveal(document.querySelector('[data-semi-retirement-inputs]'));
    },true);
    document.addEventListener('click',event=>{if(event.target.closest('[data-dollar-basis]'))queueMicrotask(sync);});
    root.visualViewport?.addEventListener('resize',updateViewport);
    root.addEventListener('resize',updateViewport);
    const footer=document.querySelector('.wizard-actions');if(footer)new ResizeObserver(updateViewport).observe(footer);
    // Some existing event paths render a form independently of renderAll.
    const investing=document.getElementById('investingForm');
    if(investing)new MutationObserver(()=>tidyInvestmentAssumptions(investing)).observe(investing,{childList:true,subtree:true});
    return {sync,remember};
  }
  root.FFSMobileUsabilityStage3={keyboardOpen,mount};
})(typeof window==='undefined'?globalThis:window);
