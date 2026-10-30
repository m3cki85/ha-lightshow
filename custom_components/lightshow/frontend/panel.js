/**
 * LightShow Studio - Home Assistant Custom Panel Wrapper
 */

class LightShowPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this._iframe) {
      // Natural responsive layout without absolute x=0 positioning to prevent overlap under HA sidebar
      this.style.display = "block";
      this.style.width = "100%";
      this.style.height = "100%";
      this.style.position = "relative";
      this.style.boxSizing = "border-box";
      this.style.overflow = "hidden";
      this.style.backgroundColor = "#0e1117";

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
