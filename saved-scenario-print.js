/* Scenario print presentation: prints selected saved card or rendered comparison, not the current plan. */
(function () {
  'use strict';
  const list = document.getElementById('scenarioList');
  const comparison = document.getElementById('scenarioComparisonReport');
  if (!list) return;
  let printing = false;
  function printSection(title, nodes) {
    if (printing || !nodes.length) return;
    const root = document.createElement('section');
    root.id = 'saved-scenario-print-root';
    root.setAttribute('aria-hidden', 'true');
    const heading = document.createElement('h1');
    heading.textContent = title;
    root.append(heading);
    const date = document.createElement('p');
    date.textContent = 'Financial Freedom | ' + new Date().toLocaleDateString('en-AU') + ' | Educational modelling only — not financial advice.';
    root.append(date);
    for (const node of nodes) {
      const copy = node.cloneNode(true);
      // Printed reports must include holdings even when the screen disclosure is closed.
      copy.querySelectorAll('details').forEach(el => { el.open = true; });
      copy.querySelectorAll('button,input,textarea,select,[role="button"],.scenario-print-inline').forEach(el => el.remove());
      root.append(copy);
    }
    document.body.append(root);
    document.body.classList.add('printing-scenario-report');
    printing = true;
    const clean = () => {
      document.body.classList.remove('printing-scenario-report');
      root.remove(); printing = false;
      window.removeEventListener('afterprint', clean);
    };
    window.addEventListener('afterprint', clean, {once:true});
    try { window.print(); } catch (error) { clean(); throw error; }
  }
  function cardCandidates() {
    return Array.from(list.children).filter(el => el.nodeType === 1 && el.textContent.trim());
  }
  function enhanceCards() {
    for (const card of cardCandidates()) {
      if (card.querySelector('.scenario-print-inline')) continue;
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'btn scenario-print-inline';
      action.textContent = 'Print Report';
      action.setAttribute('aria-label','Print report for this saved scenario');
      action.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();
        printSection('Saved Scenario Report', [card]);
      });
      card.append(action);
    }
    if (!comparison || !comparison.textContent.trim() || comparison.querySelector('.scenario-print-comparison')) return;
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'btn scenario-print-inline scenario-print-comparison';
    action.textContent = 'Print Comparison Report';
    action.addEventListener('click', () => printSection('Saved Scenario Comparison Report', [comparison]));
    comparison.prepend(action);
  }
  const observer = new MutationObserver(enhanceCards);
  observer.observe(list, {childList:true});
  if (comparison) observer.observe(comparison, {childList:true});
  enhanceCards();
}());
