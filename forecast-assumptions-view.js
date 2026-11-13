(function attachForecastAssumptionsView(root) {
  "use strict";

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // Standalone view: host supplies current plan and existing save workflow.
  // Rendering never mutates the plan or saves data.
  function mount(container, { getPlan, onSave, onClose } = {}) {
    if (!container || typeof getPlan !== "function" || typeof onSave !== "function") {
      throw new Error("Assumptions view requires a container, getPlan and onSave.");
    }
    const api = root.FFSForecastAssumptions;
    if (!api) throw new Error("Forecast assumptions adapter not loaded.");
    let original = api.draft(getPlan());
    let draft = { ...original };
    let busy = false;

    function render() {
      container.replaceChildren();
      const shell = make("div", "forecast-assumptions-workspace");
      shell.append(make("h2", "", "Forecast assumptions"));
      shell.append(make("p", "", "Review your current planning assumptions. Changes are not saved until you select Save assumptions."));
      const form = make("form", "forecast-assumptions-form");
      const status = make("p", "forecast-assumptions-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      const inputs = new Map();
      for (const group of ["essential", "advanced"]) {
        const section = make("fieldset", "forecast-assumptions-group");
        section.append(make("legend", "", group === "essential" ? "Essential assumptions" : "Advanced assumptions"));
        for (const field of api.resolve(getPlan()).filter(x => x.group === group)) {
          const row = make("div", "forecast-assumptions-row");
          const id = "forecast-assumption-" + field.id;
          const label = make("label", "", field.label);
          label.htmlFor = id;
          const input = make("input", "field-input");
          input.id = id;
          input.type = "number";
          input.step = "any";
          input.inputMode = "decimal";
          input.value = String(draft[field.key]);
          input.setAttribute("aria-describedby", id + "-help");
          input.addEventListener("input", () => {
            draft[field.key] = input.value.trim() === "" ? NaN : Number(input.value);
            status.textContent = "";
          });
          const help = make("p", "forecast-assumptions-help", field.note + " Source: " + field.source + ". Percentage per year.");
          help.id = id + "-help";
          row.append(label, input, help);
          section.append(row);
          inputs.set(field.key, input);
        }
        form.append(section);
      }
      const actions = make("div", "forecast-assumptions-actions");
      const save = make("button", "btn btn-primary", "Save assumptions");
      save.type = "submit";
      const undo = make("button", "btn", "Undo unsaved edits");
      undo.type = "button";
      undo.addEventListener("click", () => {
        draft = { ...original };
        for (const [key, input] of inputs) input.value = String(draft[key]);
        status.textContent = "Unsaved edits discarded.";
      });
      actions.append(save, undo);
      if (typeof onClose === "function") {
        const close = make("button", "btn", "Close");
        close.type = "button";
        close.addEventListener("click", onClose);
        actions.append(close);
      }
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (busy) return;
        const applied = api.apply(getPlan(), draft);
        if (!applied.ok) {
          status.textContent = applied.errors.map(x => x.message).join(" ");
          return;
        }
        busy = true;
        save.disabled = true;
        status.textContent = "Saving...";
        try {
          const result = await onSave(applied.plan);
          if (result === false) throw new Error("The plan was not saved.");
          original = api.draft(getPlan());
          draft = { ...original };
          status.textContent = "Assumptions saved.";
        } catch (error) {
          status.textContent = "Unable to save assumptions. " + (error?.message || "Please try again.");
        } finally {
          busy = false;
          save.disabled = false;
        }
      });
      form.append(actions, status);
      shell.append(form);
      container.append(shell);
    }
    render();
    return { refresh: () => { original = api.draft(getPlan()); draft = { ...original }; render(); } };
  }

  const api = Object.freeze({ mount });
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FFSForecastAssumptionsView = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
