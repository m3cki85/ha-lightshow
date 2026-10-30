/**
 * LightShow Studio - Modern Multitrack Sequencer
 */

class LightShowStudio {
  constructor() {
    this.apiBase = "/api/lightshow";
    
    // State
    this.currentShow = this.createDefaultShow();
    this.lights = [];
    this.players = [];
    this.audioFiles = [];
    
    this.zoom = 70; // px per second
    this.snap = 0.25; // seconds
    this.playMode = "browser"; // "browser" or "speaker"
    this.currentTime = 0.0;
    this.isPlaying = false;
    this.isLooping = false;
    this.selectedCueRef = null; // { trackId, cueIdx }
    this.mediaHistory = [];
    this.currentMediaItems = [];
    
    // Audio Context & Waveform
    this.audioCtx = null;
    this.audioBuffer = null;
    this.animFrameId = null;
    
    // Cache DOM
    this.dom = {
      showSelect: document.getElementById("show-select"),
      btnNewShow: document.getElementById("btn-new-show"),
      btnSaveShow: document.getElementById("btn-save-show"),
      btnDeleteShow: document.getElementById("btn-delete-show"),
      btnExportYaml: document.getElementById("btn-export-yaml"),
      btnBrowseMedia: document.getElementById("btn-browse-media"),
      audioSelect: document.getElementById("audio-select"),
      audioFileInput: document.getElementById("audio-file-input"),
      playerSelect: document.getElementById("player-select"),
      modeBrowser: document.getElementById("mode-browser"),
      modeSpeaker: document.getElementById("mode-speaker"),
      btnPlay: document.getElementById("btn-play"),
      btnPause: document.getElementById("btn-pause"),
      btnStop: document.getElementById("btn-stop"),
      btnRewind: document.getElementById("btn-rewind"),
      btnLoop: document.getElementById("btn-loop"),
      timeCurrent: document.getElementById("time-current"),
      timeTotal: document.getElementById("time-total"),
      snapSelect: document.getElementById("snap-select"),
      zoomSlider: document.getElementById("zoom-slider"),
      audioTitleDisplay: document.getElementById("audio-title-display"),
      audioStatusBadge: document.getElementById("audio-status-badge"),
      rulerCanvas: document.getElementById("ruler-canvas"),
      waveformCanvas: document.getElementById("waveform-canvas"),
      audioTimeline: document.getElementById("audio-timeline"),
      playheadLine: document.getElementById("playhead-line"),
      lightTracksList: document.getElementById("light-tracks-list"),
      btnAddLight: document.getElementById("btn-add-light"),
      audioPlayer: document.getElementById("browser-audio-player"),
      // Modals
      cueModal: document.getElementById("cue-inspector-modal"),
      btnCloseInspector: document.getElementById("btn-close-inspector"),
      cueTimeInput: document.getElementById("cue-time-input"),
      cueStateOn: document.getElementById("cue-state-on"),
      cueStateOff: document.getElementById("cue-state-off"),
      cuePropertiesGroup: document.getElementById("cue-properties-group"),
      cueBrightnessSlider: document.getElementById("cue-brightness-slider"),
      cueBrightnessVal: document.getElementById("cue-brightness-val"),
      cueColorPicker: document.getElementById("cue-color-picker"),
      cueColorHex: document.getElementById("cue-color-hex"),
      cueTransitionInput: document.getElementById("cue-transition-input"),
      wledEffectContainer: document.getElementById("wled-effect-container"),
      cueEffectSelect: document.getElementById("cue-effect-select"),
      btnTestCueLive: document.getElementById("btn-test-cue-live"),
      btnDeleteCue: document.getElementById("btn-delete-cue"),
      btnSaveCue: document.getElementById("btn-save-cue"),
      // Add light modal
      addLightModal: document.getElementById("add-light-modal"),
      btnCloseAddLight: document.getElementById("btn-close-add-light"),
      lightSearchInput: document.getElementById("light-search-input"),
      lightsPickerList: document.getElementById("lights-picker-list"),
      // Media Browser Modal
      mediaModal: document.getElementById("media-browser-modal"),
      btnCloseMediaBrowser: document.getElementById("btn-close-media-browser"),
      btnCancelMediaBrowser: document.getElementById("btn-cancel-media-browser"),
      mediaBreadcrumbs: document.getElementById("media-breadcrumbs"),
      mediaSearchInput: document.getElementById("media-search-input"),
      mediaLoadingIndicator: document.getElementById("media-loading-indicator"),
      mediaItemsGrid: document.getElementById("media-items-grid"),
      // Export modal
      exportModal: document.getElementById("export-modal"),
      btnCloseExport: document.getElementById("btn-close-export"),
      exportYamlCode: document.getElementById("export-yaml-code"),
      btnCopyYaml: document.getElementById("btn-copy-yaml"),
    };

    this.init();
  }

  createDefaultShow() {
    return {
      id: "neue_lichtshow",
      name: "Neue Lichtshow",
      description: "",
      duration: 30.0,
      audio: {
        title: "",
        filename: "",
        stream_url: "",
        mass_uri: "",
        duration: 30.0,
      },
      settings: {
        default_player_entity_id: "",
        loop: false,
        fade_out_on_stop: true,
      },
      tracks: [],
    };
  }

  async init() {
    this.bindEvents();
    await Promise.all([
      this.loadLights(),
      this.loadPlayers(),
      this.loadAudioFiles(),
      this.loadShowsList(),
    ]);
    this.renderShow();
    this.startBackendStatusSync();
  }

  bindEvents() {
    // Zoom & Snap
    this.dom.zoomSlider.addEventListener("input", (e) => {
      this.zoom = parseInt(e.target.value, 10);
      this.renderTimeline();
    });

    this.dom.snapSelect.addEventListener("change", (e) => {
      this.snap = parseFloat(e.target.value);
    });

    // Play Modes
    this.dom.modeBrowser.addEventListener("click", () => this.setPlayMode("browser"));
    this.dom.modeSpeaker.addEventListener("click", () => this.setPlayMode("speaker"));

    // Transport
    this.dom.btnPlay.addEventListener("click", () => this.play());
    this.dom.btnPause.addEventListener("click", () => this.pause());
    this.dom.btnStop.addEventListener("click", () => this.stop());
    this.dom.btnRewind.addEventListener("click", () => this.seek(0));
    this.dom.btnLoop.addEventListener("click", () => {
      this.isLooping = !this.isLooping;
      this.dom.btnLoop.classList.toggle("active", this.isLooping);
      this.currentShow.settings.loop = this.isLooping;
    });

    // Audio scrubbing on waveform click
    this.dom.audioTimeline.addEventListener("click", (e) => {
      const rect = this.dom.audioTimeline.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const targetTime = Math.max(0, clickX / this.zoom);
      this.seek(targetTime);
    });

    // Shows CRUD
    this.dom.btnNewShow.addEventListener("click", () => this.handleNewShow());
    this.dom.btnSaveShow.addEventListener("click", () => this.handleSaveShow());
    this.dom.btnDeleteShow.addEventListener("click", () => this.handleDeleteShow());
    this.dom.showSelect.addEventListener("change", (e) => {
      if (e.target.value) this.loadShow(e.target.value);
    });

    // Audio Select, Browse & Upload
    this.dom.btnBrowseMedia.addEventListener("click", () => this.openMediaBrowser());
    this.dom.btnCloseMediaBrowser.addEventListener("click", () => this.dom.mediaModal.classList.add("hidden"));
    this.dom.btnCancelMediaBrowser.addEventListener("click", () => this.dom.mediaModal.classList.add("hidden"));
    this.dom.mediaSearchInput.addEventListener("input", (e) => this.filterMediaItems(e.target.value));
    this.dom.audioSelect.addEventListener("change", (e) => this.handleAudioSelect(e.target.value));
    this.dom.audioFileInput.addEventListener("change", (e) => this.handleAudioUpload(e.target.files[0]));

    // Player Select
    this.dom.playerSelect.addEventListener("change", (e) => {
      this.currentShow.settings.default_player_entity_id = e.target.value;
    });

    // Modals
    this.dom.btnAddLight.addEventListener("click", () => this.openAddLightModal());
    this.dom.btnCloseAddLight.addEventListener("click", () => this.dom.addLightModal.classList.add("hidden"));
    this.dom.lightSearchInput.addEventListener("input", (e) => this.filterLightsList(e.target.value));

    this.dom.btnExportYaml.addEventListener("click", () => this.openExportModal());
    this.dom.btnCloseExport.addEventListener("click", () => this.dom.exportModal.classList.add("hidden"));
    this.dom.btnCopyYaml.addEventListener("click", () => this.copyExportYaml());

    // Cue Inspector Events
    this.dom.btnCloseInspector.addEventListener("click", () => this.closeInspector());
    this.dom.cueBrightnessSlider.addEventListener("input", (e) => {
      const pct = Math.round((e.target.value / 255) * 100);
      this.dom.cueBrightnessVal.textContent = `${pct}%`;
    });
    
    // Quick brightness buttons
    document.querySelectorAll(".quick-buttons button").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-val");
        this.dom.cueBrightnessSlider.value = val;
        this.dom.cueBrightnessVal.textContent = `${Math.round((val / 255) * 100)}%`;
      });
    });

    // Color picker swatch & chips
    this.dom.cueColorPicker.addEventListener("input", (e) => {
      this.dom.cueColorHex.textContent = e.target.value;
    });

    document.querySelectorAll(".color-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const hex = chip.getAttribute("data-color");
        this.dom.cueColorPicker.value = hex;
        this.dom.cueColorHex.textContent = hex;
      });
    });

    // State ON/OFF toggle in Inspector
    this.dom.cueStateOn.addEventListener("click", () => this.setCueState(true));
    this.dom.cueStateOff.addEventListener("click", () => this.setCueState(false));

    // Save / Delete / Test Cue
    this.dom.btnSaveCue.addEventListener("click", () => this.saveSelectedCue());
    this.dom.btnDeleteCue.addEventListener("click", () => this.deleteSelectedCue());
    this.dom.btnTestCueLive.addEventListener("click", () => this.testSelectedCueLive());

    // Audio Element end event
    this.dom.audioPlayer.addEventListener("ended", () => {
      if (this.isLooping) {
        this.seek(0);
        this.play();
      } else {
        this.stop();
      }
    });
  }

  setPlayMode(mode) {
    this.playMode = mode;
    this.dom.modeBrowser.classList.toggle("active", mode === "browser");
    this.dom.modeSpeaker.classList.toggle("active", mode === "speaker");
  }

  // --- API LOADERS ---

  async loadLights() {
    try {
      const res = await fetch(`${this.apiBase}/lights`);
      const data = await res.json();
      this.lights = data.lights || [];
    } catch (err) {
      console.error("Failed to load lights:", err);
    }
  }

  async loadPlayers() {
    try {
      const res = await fetch(`${this.apiBase}/players`);
      const data = await res.json();
      this.players = data.players || [];
      this.renderPlayerOptions();
    } catch (err) {
      console.error("Failed to load players:", err);
    }
  }

  async loadAudioFiles() {
    try {
      const res = await fetch(`${this.apiBase}/audio`);
      const data = await res.json();
      this.audioFiles = data.files || [];
      this.renderAudioOptions();
    } catch (err) {
      console.error("Failed to load audio files:", err);
    }
  }

  // --- MUSIC ASSISTANT & MEDIA SOURCE BROWSER ---

  async openMediaBrowser(uri = null, title = "🏠 Mediathek") {
    this.dom.mediaModal.classList.remove("hidden");
    this.dom.mediaSearchInput.value = "";
    
    if (!uri) {
      this.mediaHistory = [{ title: "🏠 Mediathek", uri: null }];
    } else {
      if (this.mediaHistory[this.mediaHistory.length - 1]?.uri !== uri) {
        this.mediaHistory.push({ title, uri });
      }
    }
    this.renderMediaBreadcrumbs();
    await this.fetchMediaFolder(uri);
  }

  renderMediaBreadcrumbs() {
    this.dom.mediaBreadcrumbs.innerHTML = "";
    this.mediaHistory.forEach((h, idx) => {
      const span = document.createElement("span");
      span.className = "breadcrumb-item";
      span.textContent = h.title;
      span.addEventListener("click", () => {
        this.mediaHistory = this.mediaHistory.slice(0, idx + 1);
        this.renderMediaBreadcrumbs();
        this.fetchMediaFolder(h.uri);
      });
      this.dom.mediaBreadcrumbs.appendChild(span);

      if (idx < this.mediaHistory.length - 1) {
        const sep = document.createElement("span");
        sep.className = "breadcrumb-sep";
        sep.textContent = " > ";
        this.dom.mediaBreadcrumbs.appendChild(sep);
      }
    });
  }

  async fetchMediaFolder(uri) {
    this.dom.mediaLoadingIndicator.textContent = "Lade Medien...";
    this.dom.mediaLoadingIndicator.classList.remove("hidden");
    this.dom.mediaItemsGrid.innerHTML = "";
    
    try {
      const q = uri ? `?uri=${encodeURIComponent(uri)}` : "";
      const res = await fetch(`${this.apiBase}/media/browse${q}`);
      const data = await res.json();
      this.dom.mediaLoadingIndicator.classList.add("hidden");

      if (data && data.children && data.children.length > 0) {
        this.currentMediaItems = data.children;
        this.renderMediaGrid(this.currentMediaItems);
      } else {
        this.dom.mediaItemsGrid.innerHTML = `<div class="hint" style="grid-column: 1/-1; text-align: center; padding: 24px;">Keine Medien in diesem Ordner gefunden.</div>`;
      }
    } catch (err) {
      this.dom.mediaLoadingIndicator.classList.add("hidden");
      this.dom.mediaItemsGrid.innerHTML = `<div class="hint" style="grid-column: 1/-1; text-align: center; color: var(--danger-color); padding: 24px;">Fehler beim Laden: ${err.message}</div>`;
    }
  }

  filterMediaItems(query) {
    const q = query.toLowerCase();
    const filtered = this.currentMediaItems.filter(item => 
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.media_class && item.media_class.toLowerCase().includes(q))
    );
    this.renderMediaGrid(filtered);
  }

  renderMediaGrid(items) {
    this.dom.mediaItemsGrid.innerHTML = "";
    if (items.length === 0) {
      this.dom.mediaItemsGrid.innerHTML = `<div class="hint" style="grid-column: 1/-1; text-align: center; padding: 24px;">Keine Treffer für die Suche.</div>`;
      return;
    }

    items.forEach(item => {
      const card = document.createElement("div");
      card.className = "media-card";

      const isFolder = item.can_expand;
      const isTrack = item.can_play || item.media_class === "track";
      
      let icon = isFolder ? "📁" : "🎵";
      if (item.media_class === "artist") icon = "👤";
      else if (item.media_class === "album") icon = "💿";
      else if (item.media_class === "playlist") icon = "📑";

      card.innerHTML = `
        <div class="media-card-icon">${icon}</div>
        <div class="media-card-info">
          <span class="media-card-title" title="${item.title}">${item.title}</span>
          <span class="media-card-sub">${isFolder ? 'Ordner öffnen' : (item.media_class || 'Song übernehmen')}</span>
        </div>
      `;

      card.addEventListener("click", () => {
        if (isFolder) {
          this.openMediaBrowser(item.media_content_id, item.title);
        } else if (isTrack) {
          this.selectMediaTrack(item);
        }
      });

      this.dom.mediaItemsGrid.appendChild(card);
    });
  }

  async selectMediaTrack(item) {
    this.dom.mediaLoadingIndicator.textContent = `Lade "${item.title}"...`;
    this.dom.mediaLoadingIndicator.classList.remove("hidden");

    try {
      const res = await fetch(`${this.apiBase}/media/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_content_id: item.media_content_id })
      });
      const data = await res.json();
      this.dom.mediaLoadingIndicator.classList.add("hidden");

      if (data.success && data.url) {
        this.currentShow.audio.mass_uri = item.media_content_id;
        this.currentShow.audio.title = item.title;
        this.currentShow.audio.filename = item.title;
        this.currentShow.audio.stream_url = data.url;

        this.dom.mediaModal.classList.add("hidden");
        this.renderShow();
      } else {
        alert("Konnte Stream-URL für diesen Song nicht auflösen: " + (data.error || "Unbekannter Fehler"));
      }
    } catch (err) {
      this.dom.mediaLoadingIndicator.classList.add("hidden");
      alert("Fehler beim Auflösen des Songs: " + err.message);
    }
  }

  async loadShowsList() {
    try {
      const res = await fetch(`${this.apiBase}/shows`);
      const data = await res.json();
      this.dom.showSelect.innerHTML = `<option value="">-- Show auswählen (${data.shows.length}) --</option>`;
      data.shows.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.track_count} Spuren, ${s.cue_count} Cues)`;
        this.dom.showSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Failed to load shows list:", err);
    }
  }

  async loadShow(showId) {
    try {
      const res = await fetch(`${this.apiBase}/shows/${showId}`);
      if (!res.ok) throw new Error("Show not found");
      this.currentShow = await res.json();
      this.dom.showSelect.value = showId;
      this.renderShow();
    } catch (err) {
      alert("Fehler beim Laden der Show: " + err.message);
    }
  }

  // --- RENDERING ---

  renderPlayerOptions() {
    this.dom.playerSelect.innerHTML = `<option value="">-- Lautsprecher auswählen --</option>`;
    this.players.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.entity_id;
      opt.textContent = `${p.is_mass ? '🎵 [MASS] ' : '🔊 '}${p.name} (${p.state})`;
      this.dom.playerSelect.appendChild(opt);
    });
    if (this.currentShow.settings.default_player_entity_id) {
      this.dom.playerSelect.value = this.currentShow.settings.default_player_entity_id;
    }
  }

  renderAudioOptions() {
    this.dom.audioSelect.innerHTML = `<option value="">-- Keine Audiodatei gewählt --</option>`;
    this.audioFiles.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.url;
      opt.textContent = `${f.filename} (${f.size_mb} MB)`;
      this.dom.audioSelect.appendChild(opt);
    });
    if (this.currentShow.audio.stream_url) {
      this.dom.audioSelect.value = this.currentShow.audio.stream_url;
    }
  }

  renderShow() {
    // Show Header info
    if (this.currentShow.audio.stream_url) {
      this.dom.audioSelect.value = this.currentShow.audio.stream_url;
      this.dom.audioTitleDisplay.textContent = this.currentShow.audio.title || this.currentShow.audio.filename || "Audiodatei geladen";
      this.dom.audioStatusBadge.textContent = "Bereit";
      this.dom.audioStatusBadge.classList.add("badge-wled");
      this.loadAudioWaveform(this.currentShow.audio.stream_url);
    } else {
      this.dom.audioTitleDisplay.textContent = "Kein Audio geladen";
      this.dom.audioStatusBadge.textContent = "Keine Datei";
      this.dom.audioStatusBadge.classList.remove("badge-wled");
    }

    if (this.currentShow.settings.default_player_entity_id) {
      this.dom.playerSelect.value = this.currentShow.settings.default_player_entity_id;
    }

    this.isLooping = !!this.currentShow.settings.loop;
    this.dom.btnLoop.classList.toggle("active", this.isLooping);

    this.renderTimeline();
    this.updateTimeDisplay();
  }

  renderTimeline() {
    const totalDuration = this.currentShow.duration || 30.0;
    const timelineWidth = Math.max(1000, totalDuration * this.zoom);

    // Set widths of canvas and container
    this.dom.rulerCanvas.width = timelineWidth;
    this.dom.waveformCanvas.width = timelineWidth;
    this.dom.audioTimeline.style.width = `${timelineWidth}px`;

    this.drawRuler(timelineWidth, totalDuration);
    this.drawWaveform(timelineWidth);

    // Render Light Tracks
    this.renderLightTracks(timelineWidth);
    this.updatePlayheadPosition();
  }

  drawRuler(width, duration) {
    const ctx = this.dom.rulerCanvas.getContext("2d");
    ctx.clearRect(0, 0, width, 24);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px JetBrains Mono";
    ctx.strokeStyle = "#2e3648";
    ctx.lineWidth = 1;

    // Tick interval depends on zoom
    const step = this.zoom >= 100 ? 0.5 : (this.zoom >= 50 ? 1.0 : 2.0);

    for (let t = 0; t <= duration + 5; t += step) {
      const x = t * this.zoom;
      ctx.beginPath();
      const isMajor = Math.round(t) === t;
      const tickH = isMajor ? 12 : 6;
      ctx.moveTo(x, 24 - tickH);
      ctx.lineTo(x, 24);
      ctx.stroke();

      if (isMajor) {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60).toString().padStart(2, "0");
        ctx.fillText(`${m}:${s}`, x + 4, 14);
      }
    }
  }

  async loadAudioWaveform(url) {
    try {
      this.dom.audioPlayer.src = url;
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      
      // Update duration from actual audio buffer
      if (this.audioBuffer && this.audioBuffer.duration > 0) {
        this.currentShow.duration = this.audioBuffer.duration;
        this.currentShow.audio.duration = this.audioBuffer.duration;
      }
      this.renderTimeline();
    } catch (err) {
      console.warn("Waveform decode warning:", err);
    }
  }

  drawWaveform(width) {
    const ctx = this.dom.waveformCanvas.getContext("2d");
    const height = 64;
    ctx.clearRect(0, 0, width, height);

    if (!this.audioBuffer) {
      // Draw placeholder ambient wave
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#334155";
      ctx.font = "11px Inter";
      ctx.fillText("Audiodatei oben auswählen für visuelle Audio-Wellenform", 20, 36);
      return;
    }

    const channelData = this.audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / width);
    const amp = height / 2;

    ctx.fillStyle = "#7928ca";
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = channelData[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const y1 = (1 + min) * amp;
      const y2 = Math.max(1, (max - min) * amp);
      ctx.fillRect(i, y1, 1, y2);
    }
  }

  renderLightTracks(timelineWidth) {
    this.dom.lightTracksList.innerHTML = "";

    this.currentShow.tracks.forEach((track, trackIdx) => {
      const trackRow = document.createElement("div");
      trackRow.className = "track-row light-track-row";

      // Left Header
      const header = document.createElement("div");
      header.className = "track-header";
      
      const isWled = track.type === "wled";
      header.innerHTML = `
        <div>
          <div class="track-title-row">
            <span class="lamp-status-dot" id="dot-${track.id}"></span>
            <span class="track-name" title="${track.name}">${track.name}</span>
          </div>
          <div class="track-badges">
            <span class="badge ${isWled ? 'badge-wled' : 'badge-zigbee'}">${isWled ? 'WLED' : 'Standard/Zigbee'}</span>
          </div>
        </div>
        <div class="track-actions">
          <button class="btn btn-micro btn-danger" title="Spur entfernen" data-action="del-track">✕</button>
        </div>
      `;

      header.querySelector('[data-action="del-track"]').addEventListener("click", () => {
        if (confirm(`Spur '${track.name}' entfernen?`)) {
          this.currentShow.tracks.splice(trackIdx, 1);
          this.renderTimeline();
        }
      });

      // Right Lane
      const lane = document.createElement("div");
      lane.className = "track-timeline light-timeline-lane";
      lane.style.width = `${timelineWidth}px`;

      // Click on empty space to add Cue
      lane.addEventListener("dblclick", (e) => {
        const rect = lane.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        let time = clickX / this.zoom;
        if (this.snap > 0) {
          time = Math.round(time / this.snap) * this.snap;
        }
        this.addCueToTrack(track.id, time);
      });

      // Render Cues
      track.cues.forEach((cue, cueIdx) => {
        const cueEl = document.createElement("div");
        cueEl.className = "cue-block";
        if (cue.state === "off") cueEl.classList.add("cue-off");

        const leftPx = cue.time * this.zoom;
        const widthPx = Math.max(34, (cue.transition || 0.4) * this.zoom);
        cueEl.style.left = `${leftPx}px`;
        cueEl.style.width = `${widthPx}px`;

        if (cue.state !== "off" && cue.rgb_color) {
          const [r, g, b] = cue.rgb_color;
          cueEl.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
          // Adaptive text color
          const lum = (0.299 * r + 0.587 * g + 0.114 * b);
          cueEl.style.color = lum > 140 ? "#000" : "#fff";
        }

        const labelText = cue.state === "off" ? "AUS" : (cue.effect || `${Math.round((cue.brightness || 255) / 2.55)}%`);
        cueEl.innerHTML = `
          <span class="cue-label">${labelText}</span>
          <span class="cue-sub">${cue.time.toFixed(2)}s</span>
        `;

        cueEl.addEventListener("click", (e) => {
          e.stopPropagation();
          this.openInspector(track.id, cueIdx);
        });

        lane.appendChild(cueEl);
      });

      trackRow.appendChild(header);
      trackRow.appendChild(lane);
      this.dom.lightTracksList.appendChild(trackRow);
    });
  }

  // --- CUES & TRACKS MANAGEMENT ---

  addCueToTrack(trackId, time) {
    const track = this.currentShow.tracks.find(t => t.id === trackId);
    if (!track) return;

    const newCue = {
      time: Math.max(0, parseFloat(time.toFixed(2))),
      state: "on",
      brightness: 255,
      rgb_color: [255, 0, 100],
      transition: track.type === "wled" ? 0.0 : 0.5,
      effect: "",
    };

    track.cues.push(newCue);
    track.cues.sort((a, b) => a.time - b.time);
    this.renderTimeline();
    const cueIdx = track.cues.indexOf(newCue);
    this.openInspector(trackId, cueIdx);
  }

  openInspector(trackId, cueIdx) {
    const track = this.currentShow.tracks.find(t => t.id === trackId);
    if (!track || !track.cues[cueIdx]) return;

    this.selectedCueRef = { trackId, cueIdx };
    const cue = track.cues[cueIdx];

    this.dom.cueTimeInput.value = cue.time;
    this.setCueState(cue.state !== "off");

    const bri = cue.brightness !== undefined ? cue.brightness : 255;
    this.dom.cueBrightnessSlider.value = bri;
    this.dom.cueBrightnessVal.textContent = `${Math.round((bri / 255) * 100)}%`;

    if (cue.rgb_color && cue.rgb_color.length === 3) {
      const hex = this.rgbToHex(cue.rgb_color[0], cue.rgb_color[1], cue.rgb_color[2]);
      this.dom.cueColorPicker.value = hex;
      this.dom.cueColorHex.textContent = hex;
    }

    this.dom.cueTransitionInput.value = cue.transition || 0.0;

    // WLED Effects
    const lightMeta = this.lights.find(l => l.entity_id === track.entity_id);
    const effects = (lightMeta && lightMeta.effect_list) || [];
    
    if (effects.length > 0) {
      this.dom.wledEffectContainer.style.display = "flex";
      this.dom.cueEffectSelect.innerHTML = `<option value="">-- Kein Effekt (Vollfarbe) --</option>`;
      effects.forEach(eff => {
        const opt = document.createElement("option");
        opt.value = eff;
        opt.textContent = eff;
        if (cue.effect === eff) opt.selected = true;
        this.dom.cueEffectSelect.appendChild(opt);
      });
    } else {
      this.dom.wledEffectContainer.style.display = "none";
    }

    this.dom.cueModal.classList.remove("hidden");
  }

  setCueState(isOn) {
    this.dom.cueStateOn.classList.toggle("active", isOn);
    this.dom.cueStateOff.classList.toggle("active", !isOn);
    this.dom.cuePropertiesGroup.style.display = isOn ? "flex" : "none";
  }

  saveSelectedCue() {
    if (!this.selectedCueRef) return;
    const { trackId, cueIdx } = this.selectedCueRef;
    const track = this.currentShow.tracks.find(t => t.id === trackId);
    if (!track || !track.cues[cueIdx]) return;

    const cue = track.cues[cueIdx];
    cue.time = parseFloat(parseFloat(this.dom.cueTimeInput.value).toFixed(2));
    cue.state = this.dom.cueStateOn.classList.contains("active") ? "on" : "off";
    
    if (cue.state === "on") {
      cue.brightness = parseInt(this.dom.cueBrightnessSlider.value, 10);
      cue.rgb_color = this.hexToRgb(this.dom.cueColorPicker.value);
      cue.transition = parseFloat(this.dom.cueTransitionInput.value);
      cue.effect = this.dom.cueEffectSelect.value || "";
    }

    track.cues.sort((a, b) => a.time - b.time);
    this.closeInspector();
    this.renderTimeline();
  }

  deleteSelectedCue() {
    if (!this.selectedCueRef) return;
    const { trackId, cueIdx } = this.selectedCueRef;
    const track = this.currentShow.tracks.find(t => t.id === trackId);
    if (track) {
      track.cues.splice(cueIdx, 1);
      this.closeInspector();
      this.renderTimeline();
    }
  }

  async testSelectedCueLive() {
    if (!this.selectedCueRef) return;
    const { trackId } = this.selectedCueRef;
    const track = this.currentShow.tracks.find(t => t.id === trackId);
    if (!track) return;

    const cuePayload = {
      state: this.dom.cueStateOn.classList.contains("active") ? "on" : "off",
      brightness: parseInt(this.dom.cueBrightnessSlider.value, 10),
      rgb_color: this.hexToRgb(this.dom.cueColorPicker.value),
      transition: parseFloat(this.dom.cueTransitionInput.value),
      effect: this.dom.cueEffectSelect.value || "",
    };

    try {
      await fetch(`${this.apiBase}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_cue",
          entity_id: track.entity_id,
          cue: cuePayload,
        }),
      });
    } catch (err) {
      console.error("Test cue error:", err);
    }
  }

  closeInspector() {
    this.selectedCueRef = null;
    this.dom.cueModal.classList.add("hidden");
  }

  // --- ADD LIGHT MODAL ---

  openAddLightModal() {
    this.dom.lightSearchInput.value = "";
    this.filterLightsList("");
    this.dom.addLightModal.classList.remove("hidden");
  }

  filterLightsList(query) {
    const q = query.toLowerCase();
    this.dom.lightsPickerList.innerHTML = "";

    const activeEntityIds = new Set(this.currentShow.tracks.map(t => t.entity_id));

    this.lights
      .filter(l => l.name.toLowerCase().includes(q) || l.entity_id.toLowerCase().includes(q))
      .forEach(l => {
        const isAdded = activeEntityIds.has(l.entity_id);
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
          <div>
            <strong>${l.name}</strong>
            <div style="font-size:11px; color:#94a3b8">${l.entity_id}</div>
          </div>
          <div>
            <span class="badge ${l.is_wled ? 'badge-wled' : 'badge-zigbee'}">${l.is_wled ? 'WLED Strip' : 'Lampe'}</span>
            ${isAdded ? '<span style="font-size:12px; margin-left:8px; color:#10b981">✓ In Show</span>' : ''}
          </div>
        `;

        if (!isAdded) {
          row.addEventListener("click", () => {
            this.addTrackFromLight(l);
            this.dom.addLightModal.classList.add("hidden");
          });
        }

        this.dom.lightsPickerList.appendChild(row);
      });
  }

  addTrackFromLight(light) {
    const trackId = `track_${Date.now()}`;
    const newTrack = {
      id: trackId,
      entity_id: light.entity_id,
      name: light.name,
      type: light.is_wled ? "wled" : "standard",
      cues: [
        {
          time: 0.0,
          state: "on",
          brightness: 255,
          rgb_color: [255, 200, 100],
          transition: light.is_wled ? 0.0 : 1.0,
        }
      ]
    };
    this.currentShow.tracks.push(newTrack);
    this.renderTimeline();
  }

  // --- AUDIO & PROJECT SAVE / LOAD ---

  handleAudioSelect(url) {
    this.currentShow.audio.stream_url = url;
    const file = this.audioFiles.find(f => f.url === url);
    if (file) {
      this.currentShow.audio.filename = file.filename;
      this.currentShow.audio.title = file.filename.replace(/\.[^/.]+$/, "");
    }
    this.renderShow();
  }

  async handleAudioUpload(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    this.dom.audioStatusBadge.textContent = "Wird hochgeladen...";

    try {
      const res = await fetch(`${this.apiBase}/audio/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        await this.loadAudioFiles();
        this.handleAudioSelect(data.url);
      } else {
        alert("Upload fehlgeschlagen: " + data.error);
      }
    } catch (err) {
      alert("Fehler beim Upload: " + err.message);
    }
  }

  handleNewShow() {
    const name = prompt("Name der neuen Lichtshow:", "Meine neue Lightshow");
    if (!name) return;
    this.currentShow = this.createDefaultShow();
    this.currentShow.name = name;
    this.currentShow.id = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    this.renderShow();
  }

  async handleSaveShow() {
    try {
      this.currentShow.settings.default_player_entity_id = this.dom.playerSelect.value;
      this.currentShow.settings.loop = this.isLooping;

      const res = await fetch(`${this.apiBase}/shows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.currentShow),
      });
      const data = await res.json();
      if (data.success) {
        alert("Show erfolgreich gespeichert!");
        await this.loadShowsList();
        this.dom.showSelect.value = data.id;
      } else {
        alert("Fehler beim Speichern: " + data.error);
      }
    } catch (err) {
      alert("Speicherfehler: " + err.message);
    }
  }

  async handleDeleteShow() {
    if (!this.currentShow.id) return;
    if (!confirm(`Soll die Show '${this.currentShow.name}' wirklich gelöscht werden?`)) return;

    try {
      const res = await fetch(`${this.apiBase}/shows/${this.currentShow.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        this.currentShow = this.createDefaultShow();
        await this.loadShowsList();
        this.renderShow();
      }
    } catch (err) {
      alert("Löschfehler: " + err.message);
    }
  }

  // --- AUTOMATION YAML MODAL ---

  openExportModal() {
    const showId = this.currentShow.id || "meine_show";
    const player = this.dom.playerSelect.value || "media_player.living_room_speaker";
    
    const yaml = `# LightShow Studio Automation Action
action: lightshow.play
data:
  show_id: "${showId}"
  player_entity_id: "${player}"
  loop: ${this.isLooping}`;

    this.dom.exportYamlCode.textContent = yaml;
    this.dom.exportModal.classList.remove("hidden");
  }

  copyExportYaml() {
    navigator.clipboard.writeText(this.dom.exportYamlCode.textContent);
    this.dom.btnCopyYaml.textContent = "✓ In die Zwischenablage kopiert!";
    setTimeout(() => {
      this.dom.btnCopyYaml.textContent = "In die Zwischenablage kopieren";
    }, 2000);
  }

  // --- TRANSPORT & PLAYBACK LOOP ---

  async play() {
    if (this.isPlaying) return;

    if (this.playMode === "speaker") {
      // Live via Home Assistant Backend & Music Assistant
      await fetch(`${this.apiBase}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "play",
          show_id: this.currentShow.id,
          player_entity_id: this.dom.playerSelect.value,
          start_time: this.currentTime,
          loop: this.isLooping,
        }),
      });
    } else {
      // Studio Browser Preview
      if (this.dom.audioPlayer.src) {
        this.dom.audioPlayer.currentTime = this.currentTime;
        this.dom.audioPlayer.play().catch(e => console.warn(e));
      }
    }

    this.isPlaying = true;
    this.dom.btnPlay.style.display = "none";
    this.dom.btnPause.style.display = "flex";
    this.lastTickTime = performance.now();
    this.runPlaybackLoop();
  }

  async pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.dom.btnPlay.style.display = "flex";
    this.dom.btnPause.style.display = "none";

    if (this.playMode === "speaker") {
      await fetch(`${this.apiBase}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
    } else {
      this.dom.audioPlayer.pause();
    }

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
  }

  async stop() {
    this.isPlaying = false;
    this.currentTime = 0.0;
    this.dom.btnPlay.style.display = "flex";
    this.dom.btnPause.style.display = "none";

    if (this.playMode === "speaker") {
      await fetch(`${this.apiBase}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
    } else {
      this.dom.audioPlayer.pause();
      this.dom.audioPlayer.currentTime = 0;
    }

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.updatePlayheadPosition();
    this.updateTimeDisplay();
  }

  seek(targetTime) {
    this.currentTime = Math.max(0, Math.min(targetTime, this.currentShow.duration || 60));
    if (this.playMode === "browser" && this.dom.audioPlayer.src) {
      this.dom.audioPlayer.currentTime = this.currentTime;
    }
    this.updatePlayheadPosition();
    this.updateTimeDisplay();
  }

  runPlaybackLoop() {
    if (!this.isPlaying) return;

    if (this.playMode === "browser") {
      if (this.dom.audioPlayer.src && !this.dom.audioPlayer.paused) {
        this.currentTime = this.dom.audioPlayer.currentTime;
      } else {
        const now = performance.now();
        const delta = (now - this.lastTickTime) / 1000;
        this.currentTime += delta;
        this.lastTickTime = now;
      }

      // Check end of show
      if (this.currentTime >= this.currentShow.duration) {
        if (this.isLooping) {
          this.seek(0);
        } else {
          this.stop();
          return;
        }
      }

      this.updatePlayheadPosition();
      this.updateTimeDisplay();
    }

    this.animFrameId = requestAnimationFrame(() => this.runPlaybackLoop());
  }

  startBackendStatusSync() {
    // Poll backend status periodically for sync when playing via speaker
    setInterval(async () => {
      if (this.playMode === "speaker" && this.isPlaying) {
        try {
          const res = await fetch(`${this.apiBase}/status`);
          const data = await res.json();
          if (data.state === "playing") {
            this.currentTime = data.current_time;
            this.updatePlayheadPosition();
            this.updateTimeDisplay();
          } else if (data.state === "idle" || data.state === "stopped") {
            this.stop();
          }
        } catch (e) {}
      }
    }, 250);
  }

  updatePlayheadPosition() {
    const x = this.currentTime * this.zoom;
    this.dom.playheadLine.style.transform = `translateX(${x}px)`;

    // Auto-scroll timeline to keep playhead in view
    const container = this.dom.audioTimeline;
    if (x > container.scrollLeft + container.clientWidth - 100) {
      container.scrollLeft = x - 100;
    } else if (x < container.scrollLeft) {
      container.scrollLeft = Math.max(0, x - 50);
    }
  }

  updateTimeDisplay() {
    this.dom.timeCurrent.textContent = this.formatTime(this.currentTime);
    this.dom.timeTotal.textContent = this.formatTime(this.currentShow.duration || 0);
  }

  formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  // --- UTILS ---

  rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  hexToRgb(hex) {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return res ? [
      parseInt(res[1], 16),
      parseInt(res[2], 16),
      parseInt(res[3], 16)
    ] : [255, 255, 255];
  }
}

// Bootstrap once DOM ready
window.addEventListener("DOMContentLoaded", () => {
  window.studio = new LightShowStudio();
});
