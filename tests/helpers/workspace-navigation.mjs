import assert from 'node:assert/strict';
// Check destination IDs, labels, grouping and uniqueness independently of SVG
// icon markup. The five primary tabs were introduced by commit 6724713.
export const PRIMARY_NAVIGATION = Object.freeze([
  'dashboard:Home', 'setup:My Plan', 'goals:Goals', 'semiretirement:Retirement', 'weeklyplan:Weekly',
]);
export const MORE_NAVIGATION = Object.freeze([
  'decision:Try a Change', 'investments:Investments', 'super:Super', 'reports:Reports', 'scenarios:Saved Scenarios',
]);
export function workspaceNavigation(html) {
  const start=html.indexOf('id="sideNav"');
  assert.ok(start>=0,'workspace navigation exists');
  const nav=html.slice(start,html.indexOf('</nav>',start));
  const more=nav.indexOf('<details');
  assert.ok(more>0,'More tools disclosure exists');
  const buttons=source=>[...source.matchAll(/<button\b([^>]*\bdata-view="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)]
    .map(([,attributes,id,content])=>{
      assert.match(attributes,/\btype="button"/);
      assert.doesNotMatch(attributes,/\bdisabled\b|aria-hidden="true"/);
      const label=content.replace(/<svg\b[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,'').trim();
      assert.ok(label,id+' has a visible label');
      return id+':'+label;
    });
  const primary=buttons(nav.slice(0,more)), secondary=buttons(nav.slice(more));
  assert.equal(new Set([...primary,...secondary].map(item=>item.split(':')[0])).size,primary.length+secondary.length,'no duplicate destinations');
  return {nav,primary,more:secondary,items:[...primary,...secondary]};
}
