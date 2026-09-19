(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FFSDialogController = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const focusableSelector = [
    "button:not([disabled])",
    "[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  let active = null;

  function focusable(modal) {
    return Array.from(modal.querySelectorAll(focusableSelector)).filter((element) => (
      !element.closest("[hidden]")
      && !element.classList.contains("hidden")
      && element.getAttribute("aria-hidden") !== "true"
      && !element.hasAttribute("data-dialog-backdrop")
    ));
  }

  function applyBackgroundInert(modal) {
    const records = [];
    Array.from(document.body.children).forEach((element) => {
      if (element === modal || element.tagName === "SCRIPT") return;
      records.push({ element, inert: element.inert, ariaHidden: element.getAttribute("aria-hidden") });
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    return records;
  }

  function restoreBackground(records = []) {
    records.forEach(({ element, inert, ariaHidden }) => {
      element.inert = inert;
      if (ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", ariaHidden);
    });
  }

  function handleKeydown(event) {
    if (!active) return;
    if (event.key === "Escape" && active.closeOnEscape) {
      event.preventDefault();
      active.onRequestClose?.();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusable(active.modal);
    if (!items.length) {
      event.preventDefault();
      active.modal.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open(modal, options = {}) {
    if (!modal) return false;
    if (active?.modal && active.modal !== modal) active.onRequestClose?.();
    const opener = options.opener || document.activeElement;
    modal.classList.remove("hidden");
    modal.removeAttribute("aria-hidden");
    if (!modal.hasAttribute("tabindex")) modal.setAttribute("tabindex", "-1");
    active = {
      modal,
      opener,
      closeOnEscape: options.closeOnEscape !== false,
      onRequestClose: options.onRequestClose,
      background: applyBackgroundInert(modal),
    };
    document.addEventListener("keydown", handleKeydown, true);
    const requested = typeof options.initialFocus === "string" ? modal.querySelector(options.initialFocus) : options.initialFocus;
    const target = requested || focusable(modal)[0] || modal;
    target.focus();
    return true;
  }

  function close(modal) {
    if (!modal) return false;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    if (active?.modal !== modal) return true;
    document.removeEventListener("keydown", handleKeydown, true);
    const { opener, background } = active;
    active = null;
    restoreBackground(background);
    if (opener?.isConnected && typeof opener.focus === "function") opener.focus();
    return true;
  }

  function activeDialog() {
    return active?.modal || null;
  }

  return { open, close, activeDialog, focusable };
});
