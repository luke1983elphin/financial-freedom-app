import {load,household} from './fi-cashflow-fixture.mjs';
export function reportFixture(simple=false) {
  const {CALC}=load(); const p=household(CALC);
  Object.assign(p.personal,{person1Name:'Alex',person2Name:'Jordan',person1Age:43,person2Age:simple?0:41,targetAnnualSpending:55000});
  Object.assign(p.investing,{expectedInvestmentReturnPct:7,expectedSuperReturnPct:6.5,inflationPct:2.5,safeWithdrawalRatePct:4,annualInvestingTarget:18000});
  Object.assign(p.assets,{superPerson1:120000,superPerson2:simple?0:75000});
  p.assetItems.push({id:'asset-super-1',category:'super',owner:'person1',value:120000});
  if(!simple)p.assetItems.push({id:'asset-super-2',category:'super',owner:'person2',value:75000});
  p.incomeItems[0].amount=150000;
  p.liabilityItems[0].interestRatePct=5.8;
  p.liabilityItems[1].interestRatePct=6.2;
  if(!simple){
    p.incomeItems.push({id:'salary2',type:'salaryWages',owner:'person2',amount:110000,frequency:'annually'},
      {id:'div',type:'dividends',owner:'joint',amount:4500,frequency:'annually'},
      {id:'interest',type:'interest',owner:'joint',amount:1000,frequency:'annually'});
    p.liabilityItems.push({id:'study',type:'stsl',owner:'person1',balance:22000});
    p.income.person1HasStslDebt=true;p.liabilities.person1StslBalance=22000;
  } else {
    p.assetItems=p.assetItems.filter(a=>a.id!=='rental');
    p.liabilityItems=p.liabilityItems.filter(a=>a.id!=='rental-loan');
    p.incomeItems=p.incomeItems.filter(a=>a.id!=='rent');
  }
  return p;
}
