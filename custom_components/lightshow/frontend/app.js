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
      btnGrabActiveSong: document.getElementById("btn-grab-active-song"),
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
      btnQuickAddLight: document.getElementById("btn-quick-add-light"),
      btnAddCueAll: document.getElementById("btn-add-cue-all"),
      btnOpenAudioManager: document.getElementById("btn-open-audio-manager"),
      audioManagerModal: document.getElementById("audio-manager-modal"),
      btnCloseAudioManager: document.getElementById("btn-close-audio-manager"),
      btnCancelAudioManager: document.getElementById("btn-cancel-audio-manager"),
      managerAudioFileInput: document.getElementById("manager-audio-file-input"),
      audioFilesManagerList: document.getElementById("audio-files-manager-list"),
      audioManagerStatus: document.getElementById("audio-manager-status"),
      audioPlayer: document.getElementById("browser-audio-player"),
      // Modals
      cueModal: document.getElementById("cue-inspector-modal"),
      btnCloseInspector: document.getElementById("btn-close-inspector"),
      cueTimeInput: document.getElementById("cue-time-input"),
      cueDurationInput: document.getElementById("cue-duration-input"),
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
      mediaActivePlayerBanner: document.getElementById("media-active-player-banner"),
      btnCloseMediaBrowser: document.getElementById("btn-close-media-browser"),
      btnCancelMediaBrowser: document.getElementById("btn-cancel-media-browser"),
      mediaBreadcrumbs: document.getElementById("media-breadcrumbs"),
      mediaSearchInput: document.getElementById("media-search-input"),
      btnDoMediaSearch: document.getElementById("btn-do-media-search"),
      btnClearMediaSearch: document.getElementById("btn-clear-media-search"),
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

    // Audio Select, Browse, Upload & Manager
    this.dom.btnBrowseMedia.addEventListener("click", () => this.openMediaBrowser());
    if (this.dom.btnGrabActiveSong) {
      this.dom.btnGrabActiveSong.addEventListener("click", () => this.handleQuickGrabActiveSong());
    }
    this.dom.btnCloseMediaBrowser.addEventListener("click", () => this.dom.mediaModal.classList.add("hidden"));
    this.dom.btnCancelMediaBrowser.addEventListener("click", () => this.dom.mediaModal.classList.add("hidden"));

    if (this.dom.btnDoMediaSearch) {
      this.dom.btnDoMediaSearch.addEventListener("click", () => this.executeNativeSearch());
    }
    if (this.dom.btnClearMediaSearch) {
      this.dom.btnClearMediaSearch.addEventListener("click", () => this.clearMediaSearch());
    }
    this.dom.mediaSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.executeNativeSearch();
      }
    });
    this.dom.mediaSearchInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      if (this.dom.btnClearMediaSearch) {
        this.dom.btnClearMediaSearch.classList.toggle("hidden", val === "");
      }
      if (val === "" && this.isSearchActive) {
        this.clearMediaSearch();
      }
    });

    if (this.dom.btnOpenAudioManager) {
      this.dom.btnOpenAudioManager.addEventListener("click", () => this.openAudioManager());
      this.dom.btnCloseAudioManager.addEventListener("click", () => this.dom.audioManagerModal.classList.add("hidden"));
      this.dom.btnCancelAudioManager.addEventListener("click", () => this.dom.audioManagerModal.classList.add("hidden"));
      this.dom.managerAudioFileInput.addEventListener("change", (e) => this.handleAudioUploadFromManager(e.target.files[0]));
    }

    if (this.dom.btnAddCueAll) {
      this.dom.btnAddCueAll.addEventListener("click", () => this.addCueToAllTracksAtCurrentTime());
    }

    this.dom.audioSelect.addEventListener("change", (e) => this.handleAudioSelect(e.target.value));
    if (this.dom.audioFileInput) {
      this.dom.audioFileInput.addEventListener("change", (e) => this.handleAudioUpload(e.target.files[0]));
    }

    // Player Select
    this.dom.playerSelect.addEventListener("change", (e) => {
      this.currentShow.settings.default_player_entity_id = e.target.value;
    });

    // Modals
    this.dom.btnAddLight.addEventListener("click", () => this.openAddLightModal());
    if (this.dom.btnQuickAddLight) {
      this.dom.btnQuickAddLight.addEventListener("click", () => this.openAddLightModal());
    }
    this.dom.btnCloseAddLight.addEventListener("click", () => this.dom.addLightModal.classList.add("hidden"));
    this.dom.lightSearchInput.addEventListener("input", (e) => this.filterLightsList(e.target.value));

    // Media Browser quick navigation
    document.querySelectorAll(".btn-quick-media").forEach(btn => {
      btn.addEventListener("click", () => {
        const quickUri = btn.getAttribute("data-quick");
        const title = btn.textContent.trim();
        this.openMediaBrowser(quickUri, title);
      });
    });

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
    document.querySelectorAll(".quick-buttons button[data-val]").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-val");
        this.dom.cueBrightnessSlider.value = val;
        this.dom.cueBrightnessVal.textContent = `${Math.round((val / 255) * 100)}%`;
      });
    });

    // Quick duration buttons
    document.querySelectorAll(".quick-buttons .btn-dur").forEach(btn => {
      btn.addEventListener("click", () => {
        const dur = btn.getAttribute("data-dur");
        if (this.dom.cueDurationInput) this.dom.cueDurationInput.value = dur;
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

  async handleQuickGrabActiveSong() {
    try {
      const res = await fetch(`${this.apiBase}/media/active`);
      const data = await res.json();
      const active = data.active || [];

      if (active.length === 0) {
        alert("Aktuell spielt kein Lautsprecher Musik ab.\n\nStarte einfach deinen gewünschten Song in Music Assistant (oder auf deinem Lautsprecher) und klicke dann erneut auf '⚡ Vom Player übernehmen'!");
        this.openMediaBrowser();
        return;
      }

      if (active.length === 1) {
        const p = active[0];
        const songName = p.artist ? `${p.artist} - ${p.title}` : p.title;
        const conf = confirm(`Gefunden auf '${p.player_name}':\n🎵 ${songName}\n\nMöchtest du diesen Song direkt für deine LightShow übernehmen?`);
        if (conf) {
          await this.selectMediaTrack({
            media_content_id: p.media_content_id,
            title: songName,
            duration: p.duration,
          });
          if (p.player_entity_id) {
            this.currentShow.settings.default_player_entity_id = p.player_entity_id;
            this.dom.playerSelect.value = p.player_entity_id;
          }
        }
        return;
      }

      // Multiple players playing -> open modal with active players banner highlighted
      this.openMediaBrowser();
    } catch (err) {
      alert("Fehler beim Abrufen aktiver Player: " + err.message);
    }
  }

  async checkAndRenderActivePlayersBanner() {
    if (!this.dom.mediaActivePlayerBanner) return;
    this.dom.mediaActivePlayerBanner.innerHTML = "";
    this.dom.mediaActivePlayerBanner.classList.add("hidden");

    try {
      const res = await fetch(`${this.apiBase}/media/active`);
      const data = await res.json();
      const active = data.active || [];

      if (active.length > 0) {
        this.dom.mediaActivePlayerBanner.classList.remove("hidden");
        active.forEach(p => {
          const card = document.createElement("div");
          card.className = "active-player-card";
          const songName = p.artist ? `${p.artist} - ${p.title}` : p.title;
          const durBadge = p.duration > 0 ? ` (${this.formatTime(p.duration)})` : "";
          card.innerHTML = `
            <div class="active-info">
              <span class="active-badge">⚡ Aktuell auf: ${p.player_name} (${p.state === 'playing' ? '▶ Wiedergabe' : '⏸ Pausiert'})</span>
              <strong>${songName}</strong>
              <span>${p.album ? 'Album: ' + p.album : 'Music Assistant Stream'}${durBadge}</span>
            </div>
            <button class="btn btn-accent btn-small" data-action="grab">⚡ Diesen Song übernehmen</button>
          `;
          card.querySelector('[data-action="grab"]').addEventListener("click", async () => {
            await this.selectMediaTrack({
              media_content_id: p.media_content_id,
              title: songName,
              duration: p.duration,
            });
            if (p.player_entity_id) {
              this.currentShow.settings.default_player_entity_id = p.player_entity_id;
              this.dom.playerSelect.value = p.player_entity_id;
            }
          });
          this.dom.mediaActivePlayerBanner.appendChild(card);
        });
      }
    } catch (err) {
      console.warn("Could not check active players:", err);
    }
  }

  async executeNativeSearch() {
    const query = this.dom.mediaSearchInput.value.trim();
    if (!query) {
      this.clearMediaSearch();
      return;
    }

    this.isSearchActive = true;
    if (this.dom.btnClearMediaSearch) this.dom.btnClearMediaSearch.classList.remove("hidden");

    this.dom.mediaLoadingIndicator.textContent = `Suche in Music Assistant nach "${query}"...`;
    this.dom.mediaLoadingIndicator.classList.remove("hidden");
    this.dom.mediaItemsGrid.innerHTML = "";

    try {
      const res = await fetch(`${this.apiBase}/media/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      this.dom.mediaLoadingIndicator.classList.add("hidden");

      const results = data.results || [];
      if (results.length === 0) {
        this.dom.mediaItemsGrid.innerHTML = `
          <div class="hint" style="grid-column: 1/-1; text-align: center; padding: 28px;">
            Keine Songs in Music Assistant für "${query}" gefunden.<br>
            <small style="margin-top: 10px; display:inline-block; color:var(--text-main);">Tipp: Starte den Song alternativ einfach in Music Assistant und klicke oben auf '⚡ Vom Player übernehmen'!</small>
          </div>
        `;
        return;
      }

      this.renderMediaSearchResults(results);
    } catch (err) {
      this.dom.mediaLoadingIndicator.classList.add("hidden");
      this.dom.mediaItemsGrid.innerHTML = `
        <div class="hint" style="grid-column: 1/-1; text-align: center; color: var(--danger-color); padding: 24px;">
          Fehler bei der Suche: ${err.message}
        </div>
      `;
    }
  }

  clearMediaSearch() {
    this.isSearchActive = false;
    this.dom.mediaSearchInput.value = "";
    if (this.dom.btnClearMediaSearch) this.dom.btnClearMediaSearch.classList.add("hidden");
    this.fetchMediaFolder(this.mediaHistory[this.mediaHistory.length - 1]?.uri || null);
  }

  renderMediaSearchResults(items) {
    this.dom.mediaItemsGrid.innerHTML = "";
    items.forEach(item => {
      const card = document.createElement("div");
      card.className = "media-card";

      const subtitle = item.artist ? `${item.artist}${item.album ? ' • ' + item.album : ''}` : (item.album || 'Music Assistant');
      const durText = item.duration > 0 ? this.formatTime(item.duration) : '';

      card.innerHTML = `
        <div class="media-card-icon">🎵</div>
        <div class="media-card-info">
          <span class="media-card-title" title="${item.title}">${item.title}</span>
          <span class="media-card-sub" title="${subtitle}">${subtitle}</span>
        </div>
        ${durText ? `<span class="search-result-badge">${durText}</span>` : ''}
      `;

      card.addEventListener("click", () => {
        const fullTitle = item.artist ? `${item.artist} - ${item.title}` : item.title;
        this.selectMediaTrack({
          media_content_id: item.media_content_id,
          title: fullTitle,
          duration: item.duration,
        });
      });

      this.dom.mediaItemsGrid.appendChild(card);
    });
  }

  async openMediaBrowser(uri = null, title = "🏠 Mediathek") {
    this.dom.mediaModal.classList.remove("hidden");
    this.dom.mediaSearchInput.value = "";
    if (this.dom.btnClearMediaSearch) this.dom.btnClearMediaSearch.classList.add("hidden");
    this.isSearchActive = false;

    // Check for currently playing music on any speaker
    await this.checkAndRenderActivePlayersBanner();
    
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
        if (data.duration && data.duration > 0) {
          this.currentShow.duration = data.duration;
          this.currentShow.audio.duration = data.duration;
        }

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
      this.loadAudioWaveform(this.currentShow.audio.stream_url, this.currentShow.duration || 30.0);
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

  async loadAudioWaveform(url, fallbackDuration = 30.0) {
    if (!url) return;
    this.dom.audioStatusBadge.textContent = "Lade Audio...";
    this.dom.audioStatusBadge.classList.add("badge-wled");

    // Connect to browser audio player
    this.dom.audioPlayer.src = url;
    this.dom.audioPlayer.onloadedmetadata = () => {
      if (this.dom.audioPlayer.duration && !isNaN(this.dom.audioPlayer.duration) && isFinite(this.dom.audioPlayer.duration) && this.dom.audioPlayer.duration > 0) {
        this.currentShow.duration = this.dom.audioPlayer.duration;
        this.currentShow.audio.duration = this.dom.audioPlayer.duration;
        this.renderTimeline();
        this.updateTimeDisplay();
      }
    };

    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      
      // Update duration from actual audio buffer
      if (this.audioBuffer && this.audioBuffer.duration > 0) {
        this.currentShow.duration = this.audioBuffer.duration;
        this.currentShow.audio.duration = this.audioBuffer.duration;
      }
      this.dom.audioStatusBadge.textContent = "Bereit";
      this.renderTimeline();
    } catch (err) {
      console.warn("Waveform decode warning / using stream fallback:", err);
      this.audioBuffer = null;
      if (fallbackDuration && (!this.currentShow.duration || this.currentShow.duration <= 0)) {
        this.currentShow.duration = fallbackDuration;
      }
      this.dom.audioStatusBadge.textContent = "Bereit (Stream)";
      this.renderTimeline();
    }
  }

  drawWaveform(width) {
    const ctx = this.dom.waveformCanvas.getContext("2d");
    const height = 110;
    ctx.clearRect(0, 0, width, height);

    const hasAudio = !!(this.currentShow.audio.stream_url || this.currentShow.audio.mass_uri || this.currentShow.audio.filename);

    if (!hasAudio) {
      ctx.fillStyle = "#161b26";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#64748b";
      ctx.font = "13px Inter";
      ctx.fillText("🎵 Wähle oben einen Song aus Music Assistant oder lade eine MP3 hoch", 24, 60);
      return;
    }

    const mid = height / 2;

    // Glowing neon gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#00d2ff");
    grad.addColorStop(0.5, "#9333ea");
    grad.addColorStop(1, "#ff007f");
    ctx.fillStyle = grad;

    if (this.audioBuffer) {
      const channelData = this.audioBuffer.getChannelData(0);
      const step = Math.ceil(channelData.length / width);

      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = channelData[(i * step) + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        const top = mid - (max * mid * 0.95);
        const bottom = mid - (min * mid * 0.95);
        const barH = Math.max(2, bottom - top);
        ctx.fillRect(i, top, 1.8, barH);
      }
    } else {
      // Fallback synthetic rhythm waveform based on show duration & beats
      const duration = this.currentShow.duration || 30.0;
      const totalBars = Math.floor(width / 4);
      for (let b = 0; b < totalBars; b++) {
        const x = b * 4;
        const timeAtX = (x / width) * duration;
        const beat = Math.sin(timeAtX * Math.PI * 2) * 0.4 + Math.sin(timeAtX * Math.PI * 0.5) * 0.3 + 0.3;
        const amp = Math.max(0.12, Math.min(0.9, beat * (0.6 + 0.4 * Math.sin(b * 13))));
        const barH = amp * (height * 0.8);
        const top = mid - (barH / 2);
        ctx.fillRect(x, top, 2.5, barH);
      }

      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(16, 12, 360, 26);
      ctx.fillStyle = "#00d2ff";
      ctx.font = "600 11px 'JetBrains Mono', monospace";
      ctx.fillText(`🎵 ${this.currentShow.audio.title || this.currentShow.audio.filename || "Audio Stream aktiv"}`, 24, 29);
    }

    // Midline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();
  }

  renderLightTracks(timelineWidth) {
    this.dom.lightTracksList.innerHTML = "";

    if (!this.currentShow.tracks || this.currentShow.tracks.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "empty-tracks-card";
      emptyDiv.innerHTML = `
        <div class="empty-icon">💡</div>
        <h3>Noch keine Lampen in dieser Show</h3>
        <p>Füge deine Home Assistant Lichter (z.B. Zigbee, Hue, Wi-Fi) oder WLED-Streifen hinzu, um Lichteffekte und Cues passend zum Song zu erstellen.</p>
        <button id="btn-empty-add-light" class="btn btn-primary btn-large">+ Erste Lampe / WLED hinzufügen</button>
      `;
      emptyDiv.querySelector("#btn-empty-add-light").addEventListener("click", () => this.openAddLightModal());
      this.dom.lightTracksList.appendChild(emptyDiv);
      return;
    }

    this.currentShow.tracks.forEach((track, trackIdx) => {
      const trackRow = document.createElement("div");
      trackRow.className = "track-row light-track-row";

      // Left Header
      const header = document.createElement("div");
      header.className = "track-header";
      
      const isWled = track.type === "wled";
      header.innerHTML = `
        <div>
          <div class="track-header-top">
            <div class="track-title-row">
              <span class="lamp-status-dot" id="dot-${track.id}"></span>
              <span class="track-name" title="${track.name}">${track.name}</span>
            </div>
            <button class="btn btn-micro btn-danger" title="Spur entfernen" data-action="del-track">✕</button>
          </div>
          <div class="track-badges">
            <span class="badge ${isWled ? 'badge-wled' : 'badge-zigbee'}">${isWled ? 'WLED' : 'Standard/Zigbee'}</span>
          </div>
          <div class="track-controls-bar">
            <button class="btn-track-toggle" data-action="toggle-live" title="Lampe jetzt sofort an-/ausschalten">⏻ Schalten</button>
            <button class="btn-track-cue" data-action="add-cue-cursor" title="Keyframe an Cursorposition einfügen">+ Cue (${this.currentTime.toFixed(1)}s)</button>
          </div>
        </div>
      `;

      // Live Toggle Action
      header.querySelector('[data-action="toggle-live"]').addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const isCurrentlyOn = btn.classList.contains("on");
        const nextState = isCurrentlyOn ? "off" : "on";
        
        btn.classList.toggle("on", nextState === "on");
        const dot = document.getElementById(`dot-${track.id}`);
        if (dot) dot.style.background = nextState === "on" ? "#10b981" : "#334155";

        await fetch(`${this.apiBase}/control`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "test_cue",
            entity_id: track.entity_id,
            cue: {
              state: nextState,
              brightness: 255,
              rgb_color: [255, 255, 255]
            }
          })
        });
      });

      // Add Cue at Cursor
      header.querySelector('[data-action="add-cue-cursor"]').addEventListener("click", () => {
        this.addCueToTrack(track.id, this.currentTime);
      });

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
      lane.title = "Klicken, um an dieser Stelle einen Keyframe (Cue) zu setzen";

      // Click on empty space to add Cue
      lane.addEventListener("click", (e) => {
        if (e.target.closest(".cue-block")) return;
        const rect = lane.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        let time = clickX / this.zoom;
        if (this.snap > 0) {
          time = Math.round(time / this.snap) * this.snap;
        }
        this.addCueToTrack(track.id, time);
      });

      // Render Cues with Drag-to-Move and Drag-to-Resize
      track.cues.forEach((cue, cueIdx) => {
        const cueEl = document.createElement("div");
        cueEl.className = "cue-block";
        if (cue.state === "off") cueEl.classList.add("cue-off");

        const leftPx = cue.time * this.zoom;
        const dur = cue.duration !== undefined ? cue.duration : 2.0;
        const widthPx = Math.max(28, dur * this.zoom);
        cueEl.style.left = `${leftPx}px`;
        cueEl.style.width = `${widthPx}px`;

        if (cue.state !== "off" && cue.rgb_color) {
          const [r, g, b] = cue.rgb_color;
          cueEl.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
          const lum = (0.299 * r + 0.587 * g + 0.114 * b);
          cueEl.style.color = lum > 140 ? "#000" : "#fff";
        }

        const labelText = cue.state === "off" ? "AUS" : (cue.effect || `${Math.round((cue.brightness || 255) / 2.55)}%`);
        cueEl.innerHTML = `
          <div class="cue-drag-body" title="Gedrückt halten und ziehen zum Verschieben">
            <span class="cue-label">${labelText}</span>
            <span class="cue-sub">${cue.time.toFixed(2)}s | ${dur.toFixed(1)}s an</span>
          </div>
          <div class="cue-resize-handle" title="Rechten Rand ziehen, um Leuchtdauer zu verändern"></div>
        `;

        // Interactive Drag to Move
        const dragBody = cueEl.querySelector(".cue-drag-body");
        let startX = 0;
        let origTime = cue.time;
        let hasMoved = false;

        const onMouseMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - startX;
          if (Math.abs(deltaX) > 3) hasMoved = true;
          if (!hasMoved) return;

          cueEl.classList.add("dragging");
          let newTime = Math.max(0, origTime + deltaX / this.zoom);
          if (this.snap > 0) {
            newTime = Math.round(newTime / this.snap) * this.snap;
          }
          newTime = Math.max(0, parseFloat(newTime.toFixed(2)));
          cue.time = newTime;
          cueEl.style.left = `${newTime * this.zoom}px`;
          const sub = cueEl.querySelector(".cue-sub");
          if (sub) sub.textContent = `${newTime.toFixed(2)}s | ${(cue.duration || 2.0).toFixed(1)}s an`;
        };

        const onMouseUp = () => {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
          cueEl.classList.remove("dragging");

          if (hasMoved) {
            track.cues.sort((a, b) => a.time - b.time);
            this.renderTimeline();
          } else {
            // Click without drag -> open inspector
            this.openInspector(track.id, cueIdx);
          }
        };

        dragBody.addEventListener("mousedown", (downEvent) => {
          if (downEvent.button !== 0) return;
          downEvent.stopPropagation();
          startX = downEvent.clientX;
          origTime = cue.time;
          hasMoved = false;

          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        });

        // Interactive Drag to Resize Duration
        const resizeHandle = cueEl.querySelector(".cue-resize-handle");
        let resizeStartX = 0;
        let origDuration = dur;

        const onResizeMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - resizeStartX;
          let newDuration = origDuration + deltaX / this.zoom;
          if (this.snap > 0) {
            newDuration = Math.round(newDuration / this.snap) * this.snap;
          }
          newDuration = Math.max(0.2, parseFloat(newDuration.toFixed(2)));
          cue.duration = newDuration;
          const newWidthPx = Math.max(24, newDuration * this.zoom);
          cueEl.style.width = `${newWidthPx}px`;

          const sub = cueEl.querySelector(".cue-sub");
          if (sub) sub.textContent = `${cue.time.toFixed(2)}s | ${newDuration.toFixed(1)}s an`;
        };

        const onResizeUp = () => {
          window.removeEventListener("mousemove", onResizeMove);
          window.removeEventListener("mouseup", onResizeUp);
          resizeHandle.classList.remove("resizing");
          this.renderTimeline();
        };

        resizeHandle.addEventListener("mousedown", (downEvent) => {
          if (downEvent.button !== 0) return;
          downEvent.stopPropagation();
          resizeStartX = downEvent.clientX;
          origDuration = cue.duration !== undefined ? cue.duration : 2.0;
          resizeHandle.classList.add("resizing");

          window.addEventListener("mousemove", onResizeMove);
          window.addEventListener("mouseup", onResizeUp);
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
      duration: 2.0,
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
    if (this.dom.cueDurationInput) {
      this.dom.cueDurationInput.value = cue.duration !== undefined ? cue.duration : 2.0;
    }
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
    if (this.dom.cueDurationInput) {
      cue.duration = Math.max(0.1, parseFloat(parseFloat(this.dom.cueDurationInput.value || 2.0).toFixed(2)));
    }
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
      duration: parseFloat(this.dom.cueDurationInput?.value || 2.0),
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

  async handleNewShow() {
    const name = prompt("Name der neuen Lichtshow:", "Meine neue Lightshow");
    if (!name) return;
    const cleanId = name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/^_+|_+$/g, "") || "show";
    const uniqueId = `${cleanId}_${Date.now().toString().slice(-4)}`;

    this.currentShow = this.createDefaultShow();
    this.currentShow.name = name;
    this.currentShow.id = uniqueId;

    try {
      const res = await fetch(`${this.apiBase}/shows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.currentShow),
      });
      const data = await res.json();
      if (data.success) {
        await this.loadShowsList();
        this.dom.showSelect.value = uniqueId;
        this.renderShow();
      } else {
        alert("Konnte neue Show nicht speichern: " + data.error);
      }
    } catch (err) {
      alert("Fehler beim Erstellen der neuen Show: " + err.message);
    }
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

  // --- AUDIO MANAGER METHODS ---

  openAudioManager() {
    this.renderAudioManagerList();
    this.dom.audioManagerModal.classList.remove("hidden");
  }

  renderAudioManagerList() {
    this.dom.audioFilesManagerList.innerHTML = "";
    if (this.audioFiles.length === 0) {
      this.dom.audioFilesManagerList.innerHTML = `<div class="hint" style="text-align: center; padding: 20px;">Noch keine eigenen Audiodateien hochgeladen.</div>`;
      return;
    }

    this.audioFiles.forEach(f => {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div>
          <strong>${f.filename}</strong>
          <span style="font-size: 11px; color: var(--text-muted); margin-left: 8px;">(${f.size_mb} MB)</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-micro btn-secondary" data-action="preview" title="Im Browser vorhören">▶ Vorhören</button>
          <button class="btn btn-micro btn-primary" data-action="select" title="Als Audio für die Show wählen">✓ Wählen</button>
          <button class="btn btn-micro btn-danger" data-action="delete" title="Datei vom Server löschen">🗑</button>
        </div>
      `;

      row.querySelector('[data-action="preview"]').addEventListener("click", () => {
        this.dom.audioPlayer.src = f.url;
        this.dom.audioPlayer.play().catch(e => console.warn(e));
      });

      row.querySelector('[data-action="select"]').addEventListener("click", () => {
        this.handleAudioSelect(f.url);
        this.dom.audioManagerModal.classList.add("hidden");
      });

      row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
        if (confirm(`Möchtest du "${f.filename}" wirklich dauerhaft vom Server löschen?`)) {
          try {
            const res = await fetch(`${this.apiBase}/audio/${encodeURIComponent(f.filename)}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
              await this.loadAudioFiles();
              this.renderAudioManagerList();
            } else {
              alert("Löschen fehlgeschlagen: " + data.error);
            }
          } catch (err) {
            alert("Fehler beim Löschen: " + err.message);
          }
        }
      });

      this.dom.audioFilesManagerList.appendChild(row);
    });
  }

  async handleAudioUploadFromManager(file) {
    if (!file) return;
    this.dom.audioManagerStatus.textContent = "Lade hoch...";
    await this.handleAudioUpload(file);
    this.dom.audioManagerStatus.textContent = "";
    this.renderAudioManagerList();
  }

  addCueToAllTracksAtCurrentTime() {
    if (this.currentShow.tracks.length === 0) {
      alert("Füge zuerst mindestens eine Lampe über '+ Lampe hinzufügen' ein!");
      return;
    }
    const t = parseFloat(this.currentTime.toFixed(2));
    this.currentShow.tracks.forEach(track => {
      this.addCueToTrack(track.id, t);
    });
  }

  // --- TRANSPORT & PLAYBACK LOOP ---

  async play() {
    if (this.isPlaying) return;

    if (this.playMode === "speaker") {
      const selectedPlayer = this.dom.playerSelect.value;
      if (!selectedPlayer) {
        alert("Bitte wähle oben einen Lautsprecher aus, bevor du die Live-Show startest!");
        return;
      }

      this.currentShow.settings.default_player_entity_id = selectedPlayer;
      this.currentShow.settings.loop = this.isLooping;

      // Send show_data directly so playback works even with brand new/unsaved shows
      const res = await fetch(`${this.apiBase}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "play",
          show_id: this.currentShow.id,
          show_data: this.currentShow,
          player_entity_id: selectedPlayer,
          start_time: this.currentTime,
          loop: this.isLooping,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert("Fehler beim Starten der Live-Show: " + (data.error || "Unbekannter Fehler"));
        return;
      }
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
