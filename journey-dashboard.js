(function (global) {
  "use strict";
  const enabled = (search) => new URLSearchParams(search).get("dashboard") === "journey";
  // Presentation only: all amounts, ages and progress are supplied by app.js.
  function html(model, { escapeHtml: e, money, plainPercent }) {
    const amount = value => Number.isFinite(value) ? money(value) : "—";
    const button = (label, view, primary = false) => `<button type="button" class="btn ${primary ? "btn-primary" : ""}" data-view="${view}">${label} <span aria-hidden="true">↗</span></button>`;
    const metric = (label, value, note) => `<article class="journey-metric"><h3>${label}</h3><strong>${e(value)}</strong><p>${e(note)}</p></article>`;
    const ready = model.ready;
    const percent = ready && Number.isFinite(model.progress) ? model.progress : null;
    const width = percent === null ? 0 : Math.max(0, Math.min(100, percent));
    return `<div class="journey-dashboard">
      <header class="journey-heading"><p class="journey-eyebrow">YOUR PLAN, IN PERSPECTIVE</p><h1>Your journey to financial freedom</h1><p>See how your current finances, investments, super and lifestyle goals come together over time.</p></header>
      <section class="journey-progress" aria-labelledby="journey-progress-title">
        <div><p class="journey-eyebrow" id="journey-progress-title">FINANCIAL FREEDOM PROGRESS</p><div class="journey-big-value">${percent === null ? "Let’s build your picture" : `${e(plainPercent(percent))}<span> of your FI target</span>`}</div><p>${ready ? "Based on your current plan and assumptions." : "Complete your financial plan to see your progress."}</p></div>
        <div class="journey-progress-detail"><div class="journey-track" role="progressbar" aria-label="Financial Freedom progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${width}" aria-valuetext="${percent === null ? "Not available" : e(plainPercent(percent))}"><span style="width:${width}%"></span></div><p>${ready ? "Current net FI assets compared with your target FI assets." : e(model.readinessMessage || "Add your finances and lifestyle target to get started.")}</p>${ready && model.lifestyle > 0 ? `<p>Your plan models <strong>${e(amount(model.lifestyle))} a year</strong> in today’s dollars.</p>` : button("Continue Setup", "setup", true)}</div>
      </section>
      <section class="journey-path-section" aria-labelledby="journey-path-title"><div class="journey-section-heading"><h2 id="journey-path-title">Your journey</h2><span>One plan. A longer view.</span></div>
        <div class="journey-path-scroll" tabindex="0" role="region" aria-label="Financial milestones; scroll horizontally to explore"><ol class="journey-path">${model.milestones.map((item, index) => `<li class="journey-stop ${index === 0 ? "is-today" : ""}"><span class="journey-node" aria-hidden="true">${index === 0 ? "●" : ""}</span><h3>${e(item.title)}</h3><strong>${e(item.value)}</strong><p>${e(item.note || "")}</p></li>`).join("")}</ol></div>
        <p class="journey-footnote">Plan milestones are shown in sequence, not to scale. Projections depend on your assumptions.</p>
      </section>
      <section class="journey-snapshot" aria-label="Your financial snapshot">
        ${metric("Net worth", amount(ready ? model.netWorth : null), "What you own, less what you owe.")}
        ${metric("Accessible FI assets", amount(ready ? model.accessible : null), "Assets available under the FI model.")}
        ${metric(model.superLabel, amount(ready ? model.superBalance : null), model.superNote)}
        ${metric("Annual cash surplus", amount(ready ? model.surplus : null), "After tax, costs and planned investing.")}
      </section>
      <div class="journey-two-up"><section class="journey-card journey-lifestyle"><p class="journey-eyebrow">YOUR FUTURE LIFESTYLE</p><h2>Your lifestyle target</h2><strong class="journey-lifestyle-value">${amount(ready ? model.lifestyle : null)}<span> / year</span></strong><p>Today’s dollars</p><p>${e(model.retirementLabel || "Add a retirement target in your plan.")}</p>${button("Explore your projection", "decision")}</section>
      <section class="journey-card"><p class="journey-eyebrow">ROOM TO EXPLORE</p><h2>What if?</h2><p>Explore how changing one assumption could affect your projected future.</p><div class="journey-scenarios">${button("Retire earlier", "semiretirement")}${button("Work less", "semiretirement")}${button("Invest more", "decision")}${button("Change lifestyle spending", "semiretirement")}</div></section></div>
      <section class="journey-next"><div><h2>Explore your plan</h2><p>Test a change and see how it affects your projected financial future.</p></div>${button("Explore a scenario", "decision", true)}</section>
    </div>`;
  }
  global.FFSJourneyDashboard = { enabled, html };
})(typeof window !== "undefined" ? window : globalThis);
