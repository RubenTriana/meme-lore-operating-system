(function (root) {
  "use strict";

  function bindRangeButtons(range, minus, plus, onChange) {
    const step = Number(range.step) || 1;
    const update = (delta) => {
      range.value = String(Math.max(Number(range.min), Math.min(Number(range.max), Number(range.value) + delta)));
      range.dispatchEvent(new Event("input", { bubbles: true }));
      onChange?.(Number(range.value));
    };
    minus.addEventListener("click", () => update(-step));
    plus.addEventListener("click", () => update(step));
    range.addEventListener("wheel", (event) => {
      event.preventDefault();
      update(event.deltaY > 0 ? -step : step);
    }, { passive: false });
  }

  function announce(element, message) {
    element.textContent = message;
  }

  root.TantaloMonitorAccessibility = { bindRangeButtons, announce };
})(globalThis);
