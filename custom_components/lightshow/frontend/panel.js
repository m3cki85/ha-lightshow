/**
 * LightShow Studio - Home Assistant Custom Panel Wrapper
 */

/**
 * LightShow Studio - Home Assistant Custom Panel Wrapper
 */

class LightShowPanel extends HTMLElement {
  constructor() {
    super();
    this._boundResize = this._updateSize.bind(this);
  }

  connectedCallback() {
    if (!this._iframe) {
      this._setupDOM();
    }
    this._updateSize();
    window.addEventListener("resize", this._boundResize);
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this._boundResize);
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._iframe) {
      this._setupDOM();
    }
    this._updateSize();
  }

  set panel(panel) {
    this._panel = panel;
  }

  _setupDOM() {
    this.style.display = "block";
    this.style.width = "100%";
    this.style.boxSizing = "border-box";
    this.style.overflow = "hidden";
    this.style.backgroundColor = "#0e1117";
    this.style.margin = "0";
    this.style.padding = "0";

    const iframe = document.createElement("iframe");
    iframe.src = "/api/lightshow/frontend/index.html";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.display = "block";
    iframe.style.boxSizing = "border-box";
    iframe.style.margin = "0";
    iframe.style.padding = "0";
    
    this.appendChild(iframe);
    this._iframe = iframe;
  }

  _updateSize() {
    // Reset any flex min-height limitations on HA parent containers
    let p = this.parentElement;
    while (p && p !== document.body) {
      p.style.minHeight = "0";
      p.style.overflow = "hidden";
      p = p.parentElement;
    }

    // Measure exact screen coordinate top (accounts for HA top bar / header dynamically)
    const rect = this.getBoundingClientRect();
    const top = rect.top >= 0 ? rect.top : 0;
    
    // Available pixels from this element's top to the bottom of the viewport
    const availableHeight = Math.max(300, window.innerHeight - top);
    
    this.style.height = `${availableHeight}px`;
    this.style.maxHeight = `${availableHeight}px`;

    if (this._iframe) {
      this._iframe.style.height = `${availableHeight}px`;
      this._iframe.style.maxHeight = `${availableHeight}px`;
    }
  }
}

if (!customElements.get("lightshow-panel")) {
  customElements.define("lightshow-panel", LightShowPanel);
}
