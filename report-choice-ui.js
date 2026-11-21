/* Presentation-only report navigation and print controls. */
(function () {
  'use strict';
  const menu = document.getElementById('reportChoiceMenu');
  const exportButton = document.getElementById('exportButton');
  const mobileReports = document.getElementById('mobileReportsGroup');
  const scenarioPrint = document.getElementById('printSavedScenariosButton');
  const closeMenu = () => { if (menu) menu.hidden = true; exportButton?.setAttribute('aria-expanded', 'false'); };
  const showMenu = () => {
    if (!menu) return;
    menu.hidden = !menu.hidden;
    exportButton?.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) menu.querySelector('button')?.focus();
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu && !menu.hidden) { closeMenu(); exportButton?.focus(); }
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
    event.preventDefault(); event.stopImmediatePropagation(); showMenu();
  }, true);
  const chooseReport = (event) => {
    const choice = event.target.closest('[data-report-choice]');
    if (!choice) return;
    if (mobileReports?.contains(choice)) {
      mobileReports.open = false;
      document.getElementById('mobileActionMenu').open = false;
    }
    if (choice.dataset.reportChoice === 'plan') openSection('reports');
    else openSection('scenarios');
  };
  menu?.addEventListener('click', chooseReport);
  mobileReports?.addEventListener('click', chooseReport);
  document.addEventListener('click', (event) => {
    if (menu && !menu.hidden && !menu.contains(event.target) &&
      !exportButton?.contains(event.target)) closeMenu();
  });
  if (scenarioPrint) scenarioPrint.addEventListener('click', () => {
    document.body.classList.add('printing-saved-scenarios');
    window.print();
  });
  window.addEventListener('afterprint', () => document.body.classList.remove('printing-saved-scenarios'));
}());
