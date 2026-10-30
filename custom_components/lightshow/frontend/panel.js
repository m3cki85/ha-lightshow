/**
 * LightShow Studio - Home Assistant Custom Panel Wrapper
 */

class LightShowPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this._iframe) {
      this.style.display = "block";
      this.style.width = "100%";
      this.style.height = "100%";
      this.style.minHeight = "0";
      this.style.boxSizing = "border-box";
      this.style.overflow = "hidden";
      this.style.backgroundColor = "#0e1117";

      if (this.parentElement) {
        this.parentElement.style.height = "100%";
        this.parentElement.style.display = "block";
        this.parentElement.style.overflow = "hidden";
      }

      const iframe = document.createElement("iframe");
      iframe.src = "/api/lightshow/frontend/index.html";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      iframe.style.display = "block";
      iframe.style.boxSizing = "border-box";
      this.appendChild(iframe);
      this._iframe = iframe;
    }
  }

  set panel(panel) {
    this._panel = panel;
  }
}

if (!customElements.get("lightshow-panel")) {
  customElements.define("lightshow-panel", LightShowPanel);
}
