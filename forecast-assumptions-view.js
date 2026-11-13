(function attachForecastAssumptionsView(root) {
  "use strict";
  const make = (tag, className, text) => {
    const node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  };
  const copy = value => structuredClone(value);
  function mount(container, {getPlan, getIdentity = () => "plan", onSave, onRetirement, isDemo = () => false, comparison}) {
    const api = root.FFSForecastAssumptions;
    let basePlan, baseline, draft, signature, identity, busy = false, stale = false, advanced = false, preview = false;
    let status, save, dirtyLabel, errorsBox;
    const dirty = () => JSON.stringify(draft) !== JSON.stringify(baseline);
    function readPlan() {
      basePlan = copy(getPlan()); baseline = api.draft(basePlan); draft = copy(baseline);
      signature = JSON.stringify(basePlan); identity = getIdentity(); stale = false; preview = false;
    }
    function refresh(message = "") { readPlan(); render(); status.textContent = message; }
    function update() {
      dirtyLabel.textContent = stale ? "Saved plan changed — reload before saving" : dirty() ? "Unsaved edits — forecasts still use saved values" : "Showing saved assumptions";
      save.disabled = busy || stale || !dirty();
    }
    function render(message = "") {
      container.replaceChildren();
      const shell = make("section", "card forecast-assumptions-workspace");
      const heading = make("h2", "", "Forecast assumptions"); heading.tabIndex = -1;
      const header = make("header", "fa-header");
      const introduction = make("div", "fa-heading");
      introduction.append(make("p", "fa-eyebrow", "Plan Assumptions"));
      introduction.append(heading, make("p", "fa-intro", "Review the growth and inflation assumptions behind your forecasts. Edit here, then save to update your plan."));
      header.append(introduction);
      // Reattach the same comparison DOM across editor renders so its session,
      // input handlers and focus-return target stay intact.
      if (comparison) header.append(comparison);
      shell.append(header);
      dirtyLabel = make("p", "fa-state"); dirtyLabel.setAttribute("role", "status"); shell.append(dirtyLabel);
      if (isDemo()) shell.append(make("p", "fa-notice", "Sample plan: apply changes to this preview only. Your personal plan and saved scenarios will not change."));
      const form = make("form", "forecast-assumptions-form"); form.noValidate = true;
      const inputs = new Map();
      function inputRow({key,label,value,note,source,disabled=false,options}) {
        const row = make("div", "forecast-assumptions-row");
        const id = `fa-input-${inputs.size}`;
        const caption = make("label", "", label + (options ? "" : " (%)")); caption.htmlFor = id;
        const control = make(options ? "select" : "input", "field-input"); control.id = id; control.dataset.assumption = key;
        if (options) for (const [value,text] of options) { const option = make("option", "", text); option.value = value; control.append(option); }
        else { control.type = "number"; control.step = "any"; control.inputMode = "decimal"; }
        control.value = value ?? ""; control.disabled = disabled;
        const sourceLine = make("p", "fa-source", source);
        const help = make("p", "field-help", note); help.id = `${id}-help`;
        const error = make("p", "fa-field-error"); error.id = `${id}-error`;
        control.setAttribute("aria-describedby", `${help.id} ${error.id}`);
        row.append(caption,sourceLine,control,help,error); inputs.set(key,{control,error});
        return {row,control};
      }
      const essential = make("fieldset", "fa-group"); essential.append(make("legend", "", "Essential assumptions"));
      const essentialGrid = make("div", "fa-grid"); essential.append(essentialGrid);
      const details = make("details", "fa-advanced"); details.open = advanced;
      details.append(make("summary", "", "Advanced assumptions"));
      details.addEventListener("toggle",()=>{advanced=details.open;});
      const advancedGroup = make("div", "fa-grid"); details.append(advancedGroup);
      for (const field of api.resolve(basePlan)) {
        const source = `${field.source} · ${Number(field.effective.toFixed(10))}% effective${field.id === "withdrawal" && field.effective !== field.value ? ` (${field.value}% entered)` : ""}`;
        const {row,control} = inputRow({key:field.key,label:field.label,value:draft.values[field.key],source,note:field.note,disabled:!field.editable});
        control.addEventListener("input",()=>{draft.values[field.key]=control.value.trim()===""?NaN:Number(control.value);preview=false;status.textContent="";update();});
        if (!field.editable) row.append(make("p", "fa-notice", "Read-only for this plan. Save retirement timing in Retirement Planning to use wage growth in your plan forecast."));
        (field.group === "essential" ? essentialGrid : advancedGroup).append(row);
      }
      const assetGroup = make("section", "fa-asset-group");
      assetGroup.append(make("h3", "", "Individual investment assumptions"),make("p", "field-help", "Total return already includes income. Income yield is taxable whether taken as cash or reinvested. These settings keep the existing tax and cashflow treatment."));
      const assets = api.investments(basePlan);
      if (!assets.length) assetGroup.append(make("p", "field-help", "No individual financial investments are recorded. The plan investment return applies to legacy portfolio funds."));
      assets.forEach(asset=>{
        const card = make("section", "fa-asset"); card.dataset.assumptionAsset = asset.id;
        card.append(make("h4", "", asset.name));
        if (!asset.explicit) card.append(make("p", "", `Plan default: ${asset.expectedTotalReturnPct}%. This investment uses the existing portfolio return. Set up an income split in the investment's settings if needed.`));
        else {
          const grid = make("div", "fa-grid");
          const configs = [{key:"expectedTotalReturnPct",label:"Total investment return",note:"Includes capital growth and income. Income yield must not exceed this total."}];
          if (asset.supportsIncome) configs.push({key:"expectedIncomeYieldPct",label:"Income yield",note:"Part of the total return, not an additional return."},{key:"incomeTreatment",label:"Investment income",note:"Cash is available for spending; reinvested income stays invested. Both remain taxable.",options:[["reinvest","Reinvest income"],["cash","Receive as cash"]]});
          for (const config of configs) {
            const {row,control} = inputRow({...config,key:`${asset.id}.${config.key}`,value:draft.assets[asset.id][config.key],source:"Individual investment setting"});
            control.addEventListener("input",()=>{draft.assets[asset.id][config.key]=config.options?control.value:control.value.trim()===""?NaN:Number(control.value);status.textContent="";update();});
            grid.append(row);
          }
          const reset = make("button", "btn", "Use plan return"); reset.type="button";
          reset.addEventListener("click",()=>{draft.assets[asset.id].expectedTotalReturnPct=draft.values.expectedInvestmentReturnPct;render("Plan return copied into this investment's unsaved rate. Income settings are unchanged.");});
          card.append(grid,reset,make("p", "field-help", "Copies the current plan rate; this remains an individual setting and will not automatically follow later plan changes."));
        }
        assetGroup.append(card);
      });
      details.append(assetGroup);
      const propertyGroup = make("section", "fa-asset-group"); propertyGroup.append(make("h3", "", "Individual property assumptions"));
      const properties=api.properties(basePlan);
      if(!properties.length) propertyGroup.append(make("p", "field-help", "No individual properties are recorded. Home and investment-property defaults remain available above."));
      properties.forEach(property=>{
        const card=make("div", "fa-asset");card.append(make("h4", "", property.name),make("p", "", `${property.value}% · ${property.source}`));
        if(property.note) card.append(make("p", "field-help", property.note));
        if(property.canReset) {
          const reset=make("button", "btn", draft.resetProperties.includes(property.id)?"Plan growth selected — unsaved":"Use plan growth");reset.type="button";reset.disabled=draft.resetProperties.includes(property.id);
          reset.addEventListener("click",()=>{draft.resetProperties.push(property.id);render("Individual property growth will be removed when you save. Other property settings are unchanged.");});card.append(reset);
        }
        propertyGroup.append(card);
      });
      propertyGroup.append(make("p", "field-help", "These are the existing plan property assumptions. Saved retirement scenarios may have their own rates. Rental cash income follows inflation in the retirement model; property capital growth does not change that rental-income rule."));
      details.append(propertyGroup);
      const retirement=make("div","fa-notice"); retirement.append(make("h3","","Retirement-specific assumptions"),make("p","","Saved retirement scenarios keep their own assumptions and are not overwritten here. Plan-linked forecasts use your updated plan. Review separate fees, return rates, spending and access ages in Retirement Planning."));
      const link=make("button","btn","Open Retirement Planning");link.type="button";link.addEventListener("click",onRetirement);retirement.append(link);details.append(retirement);
      form.append(essential,details);
      const scope = make("section", "fa-scope");
      scope.setAttribute("aria-label", "What these affect");
      scope.append(make("h3", "", "What These Affect"));
      const scopeList = make("ul");
      for (const text of [
        isDemo() ? "Applying updates this sample preview only. Your personal saved plan and retirement snapshots stay unchanged. Individual asset settings still take priority." : "Saving updates your main saved financial plan and applicable future forecasts. Individual asset settings still take priority.",
        "Plan-linked retirement projections use applicable saved-plan assumptions under the existing model rules. Previously saved retirement scenarios may contain independent snapshots; saving here does not silently overwrite or recalculate them.",
        "Growth comparison edits are temporary. They do not save or change your main plan.",
        "Wage growth applies to saved retirement-timing forecasts, not legacy accumulation. The safe withdrawal rate is illustrative; it is not the detailed retirement spending rule.",
      ]) scopeList.append(make("li", "", text));
      scope.append(scopeList);
      form.append(scope);
      errorsBox=make("div","fa-errors"); errorsBox.setAttribute("role","alert"); form.append(errorsBox);
      const actions=make("div","forecast-assumptions-actions");
      save=make("button","btn btn-primary",isDemo()?"Apply to sample preview":"Save assumptions");save.type="submit";
      const undo=make("button","btn","Undo unsaved edits");undo.type="button";undo.addEventListener("click",()=>refresh("Unsaved edits discarded. Showing the latest saved plan assumptions."));
      const defaults=make("button","btn","Restore app defaults…");defaults.type="button";defaults.addEventListener("click",()=>{preview=true;render();container.querySelector('[data-defaults-preview]').focus();});
      actions.append(save,undo,defaults);form.append(actions);
      if(preview) {
        const box=make("section","fa-defaults-preview");box.dataset.defaultsPreview="";box.tabIndex=-1;
        box.append(make("h3","","Review default changes"),make("p","","Only the plan assumptions listed below will change. Individual investment settings, property overrides and saved retirement scenarios are retained. You must still select Save assumptions afterwards."));
        const list=make("ul");for(const change of api.defaultsPreview(basePlan,draft)) list.append(make("li","",`${change.label}: ${Number.isFinite(change.from)?change.from:"not entered"}% → ${change.to}%`));box.append(list);
        const confirm=make("button","btn","Use these defaults");confirm.type="button";confirm.dataset.confirmDefaults="";
        confirm.addEventListener("click",()=>{for(const change of api.defaultsPreview(basePlan,draft))draft.values[change.key]=change.to;preview=false;render("Defaults staged. Review and save to update your plan.");save.focus();});
        const cancel=make("button","btn","Cancel");cancel.type="button";cancel.addEventListener("click",()=>{preview=false;render();container.querySelector('[data-restore-defaults]').focus();});
        box.append(confirm,cancel);form.append(box);
      }
      defaults.dataset.restoreDefaults="";
      status=make("p","forecast-assumptions-status",message);status.setAttribute("role","status");status.setAttribute("aria-live","polite");form.append(status);
      form.addEventListener("submit",async event=>{
        event.preventDefault();if(busy)return;
        if(signature!==JSON.stringify(getPlan())||identity!==getIdentity()){sync();return;}
        if(stale||!dirty())return;
        inputs.forEach(({control,error})=>{control.removeAttribute("aria-invalid");error.textContent="";});errorsBox.replaceChildren();
        const applied=api.apply(basePlan,draft,baseline);
        if(!applied.ok){
          errorsBox.append(make("p","","Review the highlighted assumptions before saving."));
          for(const error of applied.errors){const target=inputs.get(error.key);if(target){target.control.setAttribute("aria-invalid","true");target.error.textContent=error.message;}errorsBox.append(make("p","",error.message));}
          const target=inputs.get(applied.errors[0].key)?.control;if(target){target.closest("details")?.setAttribute("open","");target.focus();}return;
        }
        busy=true;update();status.textContent="Saving…";
        try { const result=await onSave(applied.plan);if(result===false)throw new Error("The plan was not saved.");readPlan();render(isDemo()?"Sample preview updated. Personal plan unchanged.":"Assumptions saved. Forecasts now use these values."); }
        catch(error){errorsBox.textContent=`Unable to save assumptions. ${error?.message || "Please try again."} Your saved plan and forecasts are unchanged.`;status.textContent="Your edits are still here. Retry or undo them.";}
        finally {busy=false;update();}
      });
      shell.append(form);container.append(shell);update();
    }
    function sync() {
      if(busy)return;
      if(identity!==getIdentity()){refresh("Plan changed. Showing this plan's saved assumptions; previous unsaved edits were discarded.");return;}
      if(signature===JSON.stringify(getPlan()))return;
      if(dirty()){stale=true;update();status.textContent="Your plan changed elsewhere. Use Undo unsaved edits to load the latest saved values before editing again.";}
      else refresh();
    }
    readPlan();render();return {sync,dirty};
  }
  root.FFSForecastAssumptionsView=Object.freeze({mount});
})(typeof globalThis !== "undefined" ? globalThis : window);
