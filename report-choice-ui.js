/* Presentation-only report navigation and print controls. */
(function () {
  'use strict';
  const menu = document.getElementById('reportChoiceMenu');
  const exportButton = document.getElementById('exportButton');
  const mobileExport = document.querySelector('[data-mobile-action="export"]');
  const scenarioPrint = document.getElementById('printSavedScenariosButton');
  let trigger = null;
  // Outside the desktop-only toolbar so the same report choices work on mobile.
  if (menu) document.body.appendChild(menu);
  const closeMenu = () => {
    if (menu) menu.hidden = true;
    [exportButton, mobileExport].forEach(button => button?.setAttribute('aria-expanded', 'false'));
  };
  const showMenu = (button) => {
    if (!menu) return;
    const opening = menu.hidden;
    closeMenu();
    if (!opening) return;
    trigger = button;
    menu.style.top = Math.min(document.querySelector('.app-header').getBoundingClientRect().bottom + 8, innerHeight - 160) + 'px';
    menu.hidden = false;
    button?.setAttribute('aria-expanded', 'true');
    menu.querySelector('button')?.focus();
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu && !menu.hidden) { closeMenu(); trigger?.focus(); }
  });
  const openSection = (view) => {
    closeMenu();
    const nav = document.querySelector('.nav-button[data-view="' + view + '"]');
    if (nav) nav.click();
    else {
      const fallback = document.querySelector('[data-view="' + view + '"]');
      if (fallback) fallback.click();
    }
  };
  // Capture existing export clicks before the legacy handler invokes printing.
  if (exportButton) exportButton.addEventListener('click', (event) => {
    event.preventDefault(); event.stopImmediatePropagation(); showMenu(exportButton);
  }, true);
  if (mobileExport) mobileExport.addEventListener('click', (event) => {
    event.preventDefault(); event.stopImmediatePropagation();
    const sheet = document.getElementById('mobileActionMenu');
    if (sheet) sheet.open = false;
    showMenu(mobileExport);
  }, true);
  if (menu) menu.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-report-choice]');
    if (!choice) return;
    if (choice.dataset.reportChoice === 'plan') openSection('reports');
    else openSection('scenarios');
  });
  document.addEventListener('click', (event) => {
    if (menu && !menu.hidden && !menu.contains(event.target) &&
      event.target !== exportButton && event.target !== mobileExport) closeMenu();
  });
  if (scenarioPrint) scenarioPrint.addEventListener('click', () => {
    document.body.classList.add('printing-saved-scenarios');
    window.print();
  });
  window.addEventListener('afterprint', () => document.body.classList.remove('printing-saved-scenarios'));
}());
