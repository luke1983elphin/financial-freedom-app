import {reportFixture} from './report-fixture.mjs';
export function investmentReturnFixture(simple=false) {
  const plan=reportFixture(simple);
  const shares=plan.assetItems.find(a=>a.id==='shares');
  Object.assign(shares,{name:'Portfolio A',value:simple?500000:300000,owner:'person1',investmentReturnMode:'totalReturn',expectedTotalReturnPct:7,expectedIncomeYieldPct:3,incomeTreatment:simple?'reinvest':'cash'});
  if(!simple){Object.assign(plan.assetItems.find(a=>a.id==='crypto'),{name:'Portfolio B',value:200000,owner:'person2',investmentReturnMode:'totalReturn',expectedTotalReturnPct:8,expectedIncomeYieldPct:2,incomeTreatment:'reinvest'});plan.incomeItems.find(i=>i.id==='div').linkedAssetId='shares';}
  return plan;
}
