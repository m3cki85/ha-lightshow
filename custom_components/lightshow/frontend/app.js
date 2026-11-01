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
    this.playMode = "speaker"; // "speaker" (default via Music Assistant) or "browser"
    this.currentTime = 0.0;
    this.isPlaying = false;
    this.isLooping = false;
    this.selectedCueRef = null; // { trackId, cueIdx }
    this.clipboardCue = null; // Copied cue for copy-paste operations
    this.mediaHistory = [];
    this.currentMediaItems = [];
    
    // Audio Context & Waveform
    this.audioCtx = null;
    this.audioBuffer = null;
    this.audioBufferPeak = 1.0;
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
      directAudioFileInput: document.getElementById("direct-audio-file-input"),
      playerSelect: document.getElementById("player-select"),
      audioDelayInput: document.getElementById("audio-delay-input"),
      modeBrowser: document.getElementById("mode-browser"),
      modeSpeaker: document.getElementById("mode-speaker"),
      btnPlay: document.getElementById("btn-play"),
      btnPause: document.getElementById("btn-pause"),
      btnStop: document.getElementById("btn-stop"),
      btnRewind: document.getElementById("btn-rewind"),
      btnLoop: document.getElementById("btn-loop"),
      btnBlackout: document.getElementById("btn-blackout"),
      btnBlackoutTransport: document.getElementById("btn-blackout-transport"),
      btnBlackoutBottom: document.getElementById("btn-blackout-bottom"),
      timeCurrent: document.getElementById("time-current"),
      timeTotal: document.getElementById("time-total"),
      btnEditDuration: document.getElementById("btn-edit-duration"),
      snapSelect: document.getElementById("snap-select"),
      zoomSlider: document.getElementById("zoom-slider"),
      audioTitleDisplay: document.getElementById("audio-title-display"),
      audioStatusBadge: document.getElementById("audio-status-badge"),
      timelineContainer: document.getElementById("timeline-container"),
      timelineScrollBar: document.getElementById("timeline-scroll-bar"),
      btnScrollLeft: document.getElementById("btn-scroll-left"),
      btnScrollRight: document.getElementById("btn-scroll-right"),
      timelineScrollTrack: document.getElementById("timeline-scroll-track"),
      timelineScrollThumb: document.getElementById("timeline-scroll-thumb"),
      timelineScrollThumbLabel: document.getElementById("timeline-scroll-thumb-label"),
      btnZoomFit: document.getElementById("btn-zoom-fit"),
      btnZoomIn: document.getElementById("btn-zoom-in"),
      btnZoomOut: document.getElementById("btn-zoom-out"),
      zoomDisplay: document.getElementById("zoom-display"),
      rulerCanvas: document.getElementById("ruler-canvas"),
      waveformCanvas: document.getElementById("waveform-canvas"),
      audioTimeline: document.getElementById("audio-timeline"),
      playheadLine: document.getElementById("playhead-line"),
      cueHud: document.getElementById("cue-hud"),
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
      cueFadeInInput: document.getElementById("cue-fade-in-input"),
      cueFadeOutInput: document.getElementById("cue-fade-out-input"),
      wledEffectContainer: document.getElementById("wled-effect-container"),
      cueEffectSelect: document.getElementById("cue-effect-select"),
      btnTestCueLive: document.getElementById("btn-test-cue-live"),
      btnDeleteCue: document.getElementById("btn-delete-cue"),
      btnSaveCue: document.getElementById("btn-save-cue"),
      // Lamp Settings Modal
      lampModal: document.getElementById("lamp-settings-modal"),
      btnCloseLampSettings: document.getElementById("btn-close-lamp-settings"),
      btnCancelLampSettings: document.getElementById("btn-cancel-lamp-settings"),
      btnSaveLampSettings: document.getElementById("btn-save-lamp-settings"),
      btnTestLampLive: document.getElementById("btn-test-lamp-live"),
      lampNameInput: document.getElementById("lamp-name-input"),
      lampEntityDisplay: document.getElementById("lamp-entity-display"),
      lampFadeInInput: document.getElementById("lamp-fade-in-input"),
      lampFadeOutInput: document.getElementById("lamp-fade-out-input"),
      lampApplyExistingCues: document.getElementById("lamp-apply-existing-cues"),
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
      contextMenu: document.getElementById("daw-context-menu"),
      toastContainer: document.getElementById("daw-toast-container"),
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

    // Play Modes (optional safe check)
    if (this.dom.modeBrowser) this.dom.modeBrowser.addEventListener("click", () => this.setPlayMode("browser"));
    if (this.dom.modeSpeaker) this.dom.modeSpeaker.addEventListener("click", () => this.setPlayMode("speaker"));

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

    // Full Timeline Horizontal Wheel Scrolling (Intuitive DAW scrolling across lanes)
    if (this.dom.timelineContainer) {
      this.dom.timelineContainer.addEventListener("wheel", (e) => {
        const isHeader = e.target.closest(".track-header");
        if (!isHeader && (e.deltaY !== 0 && e.deltaX === 0 && !e.ctrlKey)) {
          this.dom.timelineContainer.scrollLeft += e.deltaY * 0.9;
          e.preventDefault();
        }
      }, { passive: false });
    }

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
    if (this.dom.directAudioFileInput) {
      this.dom.directAudioFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleAudioUpload(e.target.files[0]);
        }
      });
    }

    // Drag & Drop audio file onto timeline
    const dropZone = document.getElementById("timeline-container") || this.dom.audioTimeline;
    if (dropZone) {
      ["dragenter", "dragover"].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add("drag-over");
        });
      });
      ["dragleave", "drop"].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove("drag-over");
        });
      });
      dropZone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          const file = dt.files[0];
          if (file.type.startsWith("audio/") || file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i)) {
            this.handleAudioUpload(file);
          }
        }
      });
    }

    // Player Select & Audio Latency Delay
    this.dom.playerSelect.addEventListener("change", (e) => {
      this.currentShow.settings.default_player_entity_id = e.target.value;
    });
    if (this.dom.audioDelayInput) {
      this.dom.audioDelayInput.addEventListener("change", (e) => {
        this.currentShow.settings.audio_delay_ms = parseInt(e.target.value, 10) || 0;
      });
    }

    // Blackout Buttons (Transport, Deck Tools, Bottom Bar)
    if (this.dom.btnBlackout) this.dom.btnBlackout.addEventListener("click", () => this.blackout());
    if (this.dom.btnBlackoutTransport) this.dom.btnBlackoutTransport.addEventListener("click", () => this.blackout());
    if (this.dom.btnBlackoutBottom) this.dom.btnBlackoutBottom.addEventListener("click", () => this.blackout());

    // Manual Song Duration Editing
    const handleEditDuration = () => {
      const curDur = this.currentShow.duration || 60;
      const m = Math.floor(curDur / 60);
      const s = Math.floor(curDur % 60);
      const curStr = `${m}:${s.toString().padStart(2, '0')}`;
      const input = prompt("Gesamtdauer des Songs / der Show eingeben (in Sekunden oder MM:SS):", curStr);
      if (!input) return;
      let newSec = 0;
      if (input.includes(":")) {
        const parts = input.split(":");
        newSec = (parseInt(parts[0], 10) || 0) * 60 + (parseFloat(parts[1]) || 0);
      } else {
        newSec = parseFloat(input) || 0;
      }
      if (newSec > 0) {
        this.currentShow.duration = newSec;
        this.currentShow.audio.duration = newSec;
        this.renderTimeline();
        this.updateTimeDisplay();
        this.showToast(`⏱️ Songdauer auf ${this.formatTime(newSec)} gesetzt`);
      }
    };
    if (this.dom.timeTotal) this.dom.timeTotal.addEventListener("click", handleEditDuration);
    if (this.dom.btnEditDuration) this.dom.btnEditDuration.addEventListener("click", handleEditDuration);

    // Dedicated Permanent Horizontal Timeline Scrollbar & Navigation
    if (this.dom.timelineContainer) {
      this.dom.timelineContainer.addEventListener("scroll", () => this.updateHorizontalScrollbar());
    }
    window.addEventListener("resize", () => this.updateHorizontalScrollbar());

    if (this.dom.btnScrollLeft) {
      this.dom.btnScrollLeft.addEventListener("click", () => {
        this.dom.timelineContainer.scrollLeft -= 250;
      });
    }

    if (this.dom.btnScrollRight) {
      this.dom.btnScrollRight.addEventListener("click", () => {
        this.dom.timelineContainer.scrollLeft += 250;
      });
    }

    if (this.dom.btnZoomIn) {
      this.dom.btnZoomIn.addEventListener("click", () => {
        this.zoom = Math.min(250, this.zoom + 15);
        this.dom.zoomSlider.value = this.zoom;
        this.renderTimeline();
      });
    }

    if (this.dom.btnZoomOut) {
      this.dom.btnZoomOut.addEventListener("click", () => {
        this.zoom = Math.max(10, this.zoom - 15);
        this.dom.zoomSlider.value = this.zoom;
        this.renderTimeline();
      });
    }

    if (this.dom.btnZoomFit) {
      this.dom.btnZoomFit.addEventListener("click", () => this.fitSongToScreen());
    }

    // Dragging the horizontal scrollbar thumb
    if (this.dom.timelineScrollThumb && this.dom.timelineScrollTrack) {
      let isDraggingThumb = false;
      let startMouseX = 0;
      let startScrollLeft = 0;

      this.dom.timelineScrollThumb.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        isDraggingThumb = true;
        startMouseX = e.clientX;
        startScrollLeft = this.dom.timelineContainer.scrollLeft;
        document.body.style.cursor = "grabbing";

        const onMouseMove = (ev) => {
          if (!isDraggingThumb) return;
          const deltaX = ev.clientX - startMouseX;
          const trackWidth = this.dom.timelineScrollTrack.clientWidth;
          const thumbWidth = this.dom.timelineScrollThumb.offsetWidth;
          const scrollableTrack = trackWidth - thumbWidth;
          if (scrollableTrack <= 0) return;

          const maxScrollLeft = this.dom.timelineContainer.scrollWidth - this.dom.timelineContainer.clientWidth;
          const scrollRatio = deltaX / scrollableTrack;
          this.dom.timelineContainer.scrollLeft = Math.max(0, Math.min(maxScrollLeft, startScrollLeft + scrollRatio * maxScrollLeft));
        };

        const onMouseUp = () => {
          isDraggingThumb = false;
          document.body.style.cursor = "";
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });

      // Click on track to jump
      this.dom.timelineScrollTrack.addEventListener("click", (e) => {
        if (e.target.closest("#timeline-scroll-thumb")) return;
        const rect = this.dom.timelineScrollTrack.getBoundingClientRect();
        const clickRatio = (e.clientX - rect.left) / rect.width;
        const maxScrollLeft = this.dom.timelineContainer.scrollWidth - this.dom.timelineContainer.clientWidth;
        this.dom.timelineContainer.scrollLeft = clickRatio * maxScrollLeft;
      });
    }

    // Lamp Settings Modal Events
    if (this.dom.btnCloseLampSettings) this.dom.btnCloseLampSettings.addEventListener("click", () => this.closeLampSettings());
    if (this.dom.btnCancelLampSettings) this.dom.btnCancelLampSettings.addEventListener("click", () => this.closeLampSettings());
    if (this.dom.btnSaveLampSettings) this.dom.btnSaveLampSettings.addEventListener("click", () => this.saveLampSettings());
    if (this.dom.btnTestLampLive) this.dom.btnTestLampLive.addEventListener("click", () => this.testLampLive());

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

    // Global Keyboard Shortcuts (Space, Delete/Backspace, Escape, Arrows, Home)
    window.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
      const isInput = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable);
      
      if (e.code === "Space" && !isInput) {
        e.preventDefault();
        if (this.isPlaying) {
          this.pause();
        } else {
          this.play();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !isInput) {
        if (this.selectedCueRef) {
          e.preventDefault();
          const { trackId, cueIdx } = this.selectedCueRef;
          const track = this.currentShow.tracks.find(t => t.id === trackId);
          if (track && track.cues[cueIdx]) {
            this.copyCue(track.cues[cueIdx]);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && !isInput) {
        if (this.clipboardCue && !isInput) {
          e.preventDefault();
          let targetTrackId = this.selectedCueRef?.trackId;
          if (!targetTrackId && this.currentShow.tracks.length > 0) {
            targetTrackId = this.currentShow.tracks[0].id;
          }
          if (targetTrackId) {
            this.pasteCueAt(targetTrackId, this.currentTime);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && !isInput) {
        if (this.selectedCueRef) {
          e.preventDefault();
          const { trackId, cueIdx } = this.selectedCueRef;
          this.duplicateCue(trackId, cueIdx);
        }
      } else if ((e.key === "Delete" || e.key === "Backspace") && !isInput) {
        if (this.selectedCueRef) {
          e.preventDefault();
          this.deleteSelectedCue();
        }
      } else if (e.key === "Escape") {
        const modalOpen = (this.dom.cueModal && !this.dom.cueModal.classList.contains("hidden"))
          || (this.dom.lampModal && !this.dom.lampModal.classList.contains("hidden"))
          || (this.dom.mediaModal && !this.dom.mediaModal.classList.contains("hidden"))
          || (this.dom.audioManagerModal && !this.dom.audioManagerModal.classList.contains("hidden"))
          || (this.dom.addLightModal && !this.dom.addLightModal.classList.contains("hidden"))
          || (this.dom.exportModal && !this.dom.exportModal.classList.contains("hidden"));

        this.hideContextMenu();
        this.deselectCue();
        if (this.dom.cueModal && !this.dom.cueModal.classList.contains("hidden")) this.closeInspector();
        if (this.dom.lampModal && !this.dom.lampModal.classList.contains("hidden")) this.closeLampSettings();
        if (this.dom.mediaModal && !this.dom.mediaModal.classList.contains("hidden")) this.dom.mediaModal.classList.add("hidden");
        if (this.dom.audioManagerModal && !this.dom.audioManagerModal.classList.contains("hidden")) this.dom.audioManagerModal.classList.add("hidden");
        if (this.dom.addLightModal && !this.dom.addLightModal.classList.contains("hidden")) this.dom.addLightModal.classList.add("hidden");
        if (this.dom.exportModal && !this.dom.exportModal.classList.contains("hidden")) this.dom.exportModal.classList.add("hidden");

        // If no modal was open, Escape acts as immediate Blackout
        if (!modalOpen && !isInput) {
          this.blackout();
        }
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !isInput && this.selectedCueRef) {
        e.preventDefault();
        const { trackId, cueIdx } = this.selectedCueRef;
        const track = this.currentShow.tracks.find(t => t.id === trackId);
        if (track && track.cues[cueIdx]) {
          const cue = track.cues[cueIdx];
          const step = e.shiftKey ? 0.02 : (this.snap > 0 ? this.snap : 0.1);
          const delta = e.key === "ArrowLeft" ? -step : step;
          cue.time = Math.max(0, parseFloat((cue.time + delta).toFixed(2)));
          track.cues.sort((a, b) => a.time - b.time);
          this.selectedCueRef = { trackId, cueIdx: track.cues.indexOf(cue) };
          this.renderTimeline();
        }
      } else if (e.key === "Home" && !isInput) {
        e.preventDefault();
        this.seek(0);
      }
    });

    // Close Context Menu and deselect cue when clicking on empty workspace
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#daw-context-menu")) {
        this.hideContextMenu();
      }
    });

    document.addEventListener("contextmenu", (e) => {
      if (!e.target.closest(".cue-block") && !e.target.closest(".light-timeline-lane")) {
        this.hideContextMenu();
      }
    });

    if (this.dom.timelineContainer) {
      this.dom.timelineContainer.addEventListener("click", (e) => {
        if (!e.target.closest(".cue-block") && !e.target.closest(".track-header") && !e.target.closest(".modal-content") && !e.target.closest("#daw-context-menu")) {
          this.deselectCue();
        }
      });
    }
  }

  setPlayMode(mode) {
    this.playMode = mode;
    if (this.dom.modeBrowser) this.dom.modeBrowser.classList.toggle("active", mode === "browser");
    if (this.dom.modeSpeaker) this.dom.modeSpeaker.classList.toggle("active", mode === "speaker");
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

      // Check if the currently selected player has a track
      const selectedPlayerId = this.dom.playerSelect?.value;
      if (selectedPlayerId) {
        const found = active.find(p => p.player_entity_id === selectedPlayerId && p.has_track);
        if (found) {
          const songName = found.artist ? `${found.artist} - ${found.title}` : found.title;
          const conf = confirm(`Gefunden auf ausgewähltem Player '${found.player_name}':\n🎵 ${songName}\n\nMöchtest du diesen Song für deine LightShow übernehmen?`);
          if (conf) {
            this.currentShow.settings.default_player_entity_id = found.player_entity_id;
            this.dom.playerSelect.value = found.player_entity_id;
            this.setPlayMode("speaker");
            await this.selectMediaTrack({
              media_content_id: found.media_content_id,
              title: songName,
              duration: found.duration,
            });
            return;
          }
        }
      }

      // If exactly 1 player with track is found
      const playersWithTrack = active.filter(p => p.has_track);
      if (playersWithTrack.length === 1) {
        const p = playersWithTrack[0];
        const songName = p.artist ? `${p.artist} - ${p.title}` : p.title;
        const conf = confirm(`Gefunden auf '${p.player_name}':\n🎵 ${songName}\n\nMöchtest du diesen Song direkt für deine LightShow übernehmen?`);
        if (conf) {
          if (p.player_entity_id) {
            this.currentShow.settings.default_player_entity_id = p.player_entity_id;
            this.dom.playerSelect.value = p.player_entity_id;
          }
          this.setPlayMode("speaker");
          await this.selectMediaTrack({
            media_content_id: p.media_content_id,
            title: songName,
            duration: p.duration,
          });
          return;
        }
      }

      // Open media browser modal with active player list
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
        
        const playersWithTrack = active.filter(p => p.has_track);
        const idlePlayers = active.filter(p => !p.has_track);

        const createCard = (p) => {
          const card = document.createElement("div");
          card.className = "active-player-card";
          const hasTrack = !!p.has_track;
          const songName = p.artist ? `${p.artist} - ${p.title}` : p.title;
          const durBadge = p.duration > 0 ? ` (${this.formatTime(p.duration)})` : "";
          
          let stateLabel = "▶ Spielt gerade";
          if (p.state === "paused") stateLabel = "⏸ Pausiert";
          else if (p.state === "idle") stateLabel = "⏹ Zuletzt gespielt";
          else if (!hasTrack) stateLabel = "Bereit";

          let typeBadge = p.provider_label || (p.is_mass ? "Music Assistant" : "HA Player");
          if (p.provider_label === "Plex") typeBadge = "🎬 Plex";
          else if (p.provider_label === "Jellyfin") typeBadge = "🍿 Jellyfin";
          else if (p.provider_label === "Subsonic / Navidrome") typeBadge = "📻 Navidrome / Subsonic";
          else if (p.provider_label === "Lokale Datei (SMB/Disk)") typeBadge = "📁 Lokale Datei (SMB/Disk)";
          else if (p.provider_label === "Emby") typeBadge = "🍿 Emby";
          else if (p.is_mass) typeBadge = "🎵 Music Assistant";
          else typeBadge = "🔊 HA Player";

          const lowerName = (p.player_name || "").toLowerCase();
          if (lowerName.includes("web") || lowerName.includes("device") || lowerName.includes("browser") || lowerName.includes("lokal") || lowerName.includes("sendspin")) {
            typeBadge = "💻 Lokaler Player (MASS)";
          }

          card.innerHTML = `
            <div class="active-info">
              <span class="active-badge">⚡ [${typeBadge}] ${p.player_name} (${stateLabel})</span>
              <strong>${songName}</strong>
              <span>${p.album ? 'Album: ' + p.album : (hasTrack ? 'Music Assistant Stream' : 'Keine aktuelle Wiedergabe')}${durBadge}</span>
            </div>
            <button class="btn ${hasTrack ? 'btn-accent' : 'btn-secondary'} btn-small" data-action="action-btn">
              ${hasTrack ? '⚡ Diesen Song übernehmen' : '🔊 Als Player wählen'}
            </button>
          `;

          card.querySelector('[data-action="action-btn"]').addEventListener("click", async () => {
            if (p.player_entity_id) {
              this.currentShow.settings.default_player_entity_id = p.player_entity_id;
              this.dom.playerSelect.value = p.player_entity_id;
            }

            if (hasTrack) {
              await this.selectMediaTrack({
                media_content_id: p.media_content_id,
                title: songName,
                duration: p.duration,
              });
            } else {
              alert(`Lautsprecher '${p.player_name}' für die Show ausgewählt!\n\nStarte deinen gewünschten Song in Music Assistant auf diesem Lautsprecher und klicke dann auf '⚡ Vom Player übernehmen'.`);
              this.dom.mediaModal.classList.add("hidden");
            }
          });
          return card;
        };

        if (playersWithTrack.length > 0) {
          const header = document.createElement("div");
          header.style.cssText = "font-size: 11px; font-weight: 700; color: var(--cyan-accent); margin-bottom: 4px; text-transform: uppercase;";
          header.textContent = "🎵 Aktive Wiedergabe gefunden (1-Klick Song übernehmen):";
          this.dom.mediaActivePlayerBanner.appendChild(header);

          playersWithTrack.forEach(p => {
            this.dom.mediaActivePlayerBanner.appendChild(createCard(p));
          });

          if (idlePlayers.length > 0) {
            const details = document.createElement("details");
            details.style.cssText = "margin-top: 6px; font-size: 12px;";
            details.innerHTML = `<summary style="color: var(--text-muted); cursor: pointer; padding: 4px 0;">▶ Weitere Lautsprecher zur Wiedergabe wählen (${idlePlayers.length})</summary>`;
            const listDiv = document.createElement("div");
            listDiv.style.cssText = "display: flex; flex-direction: column; gap: 6px; margin-top: 6px;";
            idlePlayers.forEach(p => listDiv.appendChild(createCard(p)));
            details.appendChild(listDiv);
            this.dom.mediaActivePlayerBanner.appendChild(details);
          }
        } else {
          const header = document.createElement("div");
          header.style.cssText = "font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase;";
          header.textContent = "🔊 Verfügbare Lautsprecher & Music Assistant Player:";
          this.dom.mediaActivePlayerBanner.appendChild(header);

          idlePlayers.slice(0, 5).forEach(p => {
            this.dom.mediaActivePlayerBanner.appendChild(createCard(p));
          });

          if (idlePlayers.length > 5) {
            const details = document.createElement("details");
            details.style.cssText = "margin-top: 4px; font-size: 12px;";
            details.innerHTML = `<summary style="color: var(--text-muted); cursor: pointer; padding: 4px 0;">▶ ${idlePlayers.length - 5} weitere Lautsprecher anzeigen</summary>`;
            const listDiv = document.createElement("div");
            listDiv.style.cssText = "display: flex; flex-direction: column; gap: 6px; margin-top: 6px;";
            idlePlayers.slice(5).forEach(p => listDiv.appendChild(createCard(p)));
            details.appendChild(listDiv);
            this.dom.mediaActivePlayerBanner.appendChild(details);
          }
        }
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

    let streamUrl = null;
    let trackDuration = item.duration || 0;

    try {
      const res = await fetch(`${this.apiBase}/media/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_content_id: item.media_content_id })
      });
      const data = await res.json();
      if (data && data.success) {
        if (data.direct_stream_available && data.url) {
          streamUrl = data.url;
        }
        if (data.duration && data.duration > 0) {
          trackDuration = data.duration;
        }
      }
    } catch (err) {
      console.warn("Could not resolve stream URL for preview, using live mode:", err);
    } finally {
      this.dom.mediaLoadingIndicator.classList.add("hidden");
    }

    // Always accept the song into currentShow!
    this.currentShow.audio.mass_uri = item.media_content_id;
    this.currentShow.audio.title = item.title;
    this.currentShow.audio.filename = item.title;
    this.currentShow.audio.stream_url = streamUrl;

    if (trackDuration > 0) {
      this.currentShow.duration = trackDuration;
      this.currentShow.audio.duration = trackDuration;
    }

    this.dom.mediaModal.classList.add("hidden");
    this.renderShow();
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
    } else if (this.currentShow.audio.mass_uri) {
      const opt = document.createElement("option");
      opt.value = this.currentShow.audio.mass_uri;
      opt.textContent = `🎵 ${this.currentShow.audio.title || "Music Assistant Stream"}`;
      this.dom.audioSelect.appendChild(opt);
      this.dom.audioSelect.value = this.currentShow.audio.mass_uri;
    }
  }

  renderShow() {
    // Show Header info
    const streamUrl = this.currentShow.audio.stream_url;
    const hasAudio = !!(streamUrl || this.currentShow.audio.mass_uri || this.currentShow.audio.filename);

    if (hasAudio) {
      this.renderAudioOptions();
      this.dom.audioTitleDisplay.textContent = this.currentShow.audio.title || this.currentShow.audio.filename || "Audiodatei geladen";

      if (this.currentShow.audio.mass_uri) {
        this.dom.audioStatusBadge.textContent = "✅ Bereit (Music Assistant)";
        this.dom.audioStatusBadge.className = "badge badge-wled";
        this.loadAudioWaveform(streamUrl || this.currentShow.audio.mass_uri, this.currentShow.duration || 30.0);
      } else if (streamUrl) {
        this.dom.audioStatusBadge.textContent = "✅ Bereit (Datei)";
        this.dom.audioStatusBadge.className = "badge badge-wled";
        this.loadAudioWaveform(streamUrl, this.currentShow.duration || 30.0);
      } else {
        this.dom.audioStatusBadge.textContent = "✅ Bereit";
        this.dom.audioStatusBadge.className = "badge badge-wled";
        this.loadAudioWaveform(null, this.currentShow.duration || 30.0);
      }
    } else {
      this.renderAudioOptions();
      this.dom.audioTitleDisplay.textContent = "Kein Audio geladen";
      this.dom.audioStatusBadge.textContent = "Keine Datei";
      this.dom.audioStatusBadge.className = "badge";
      this.dom.audioPlayer.removeAttribute("src");
      this.audioBuffer = null;
    }

    if (this.currentShow.settings.default_player_entity_id) {
      this.dom.playerSelect.value = this.currentShow.settings.default_player_entity_id;
    }

    if (this.dom.audioDelayInput) {
      this.dom.audioDelayInput.value = this.currentShow.settings.audio_delay_ms ?? 0;
    }

    this.isLooping = !!this.currentShow.settings.loop;
    this.dom.btnLoop.classList.toggle("active", this.isLooping);

    this.renderTimeline();
    this.updateTimeDisplay();
  }

  renderTimeline() {
    let totalDuration = Math.max(this.currentShow.duration || 0, this.currentShow.audio?.duration || 0);
    (this.currentShow.tracks || []).forEach(tr => {
      (tr.cues || []).forEach(c => {
        const endT = (c.time || 0) + (c.duration || 2.0);
        if (endT > totalDuration) totalDuration = endT;
      });
    });

    if (totalDuration <= 0) totalDuration = 240.0; // 4 minutes standard song fallback
    this.currentShow.duration = totalDuration;

    // Extra margin so user can comfortably scroll and position beyond the end of the song
    const timelineWidth = Math.max(1400, Math.ceil((totalDuration + 8) * this.zoom));

    // Dynamic heights matching rendered CSS layout (default 120px for full-bleed waveform)
    const waveH = this.dom.waveformCanvas?.clientHeight || 120;
    const rulerH = this.dom.rulerCanvas?.clientHeight || 26;

    // Set widths and heights of canvas and container
    this.dom.rulerCanvas.width = timelineWidth;
    this.dom.rulerCanvas.height = rulerH;
    this.dom.waveformCanvas.width = timelineWidth;
    this.dom.waveformCanvas.height = waveH;
    this.dom.audioTimeline.style.width = `${timelineWidth}px`;
    this.dom.audioTimeline.style.minWidth = `${timelineWidth}px`;

    this.drawRuler(timelineWidth, totalDuration);
    this.drawWaveform(timelineWidth);

    // Render Light Tracks
    this.renderLightTracks(timelineWidth);
    this.updatePlayheadPosition();
    this.updateHorizontalScrollbar();
  }

  drawRuler(width, duration) {
    const ctx = this.dom.rulerCanvas.getContext("2d");
    const height = this.dom.rulerCanvas.height || 26;
    ctx.clearRect(0, 0, width, height);

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
      ctx.moveTo(x, height - tickH);
      ctx.lineTo(x, height);
      ctx.stroke();

      if (isMajor) {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60).toString().padStart(2, "0");
        ctx.fillText(`${m}:${s}`, x + 4, height - 12);
      }
    }
  }

  async loadAudioWaveform(url, fallbackDuration = 30.0) {
    if (!url) {
      this.dom.audioStatusBadge.textContent = "✅ Bereit (Music Assistant)";
      this.dom.audioStatusBadge.className = "badge badge-wled";
      this.renderTimeline();
      return;
    }

    // Only decode audio in Web Audio API if it's a local static uploaded file
    if (url.startsWith("/api/lightshow/audio/")) {
      this.dom.audioStatusBadge.textContent = "Lade Audio...";
      this.dom.audioStatusBadge.className = "badge badge-wled";
      if (this.dom.audioPlayer) this.dom.audioPlayer.src = url;

      try {
        if (!this.audioCtx) {
          this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

        if (this.audioBuffer && this.audioBuffer.duration > 0) {
          this.currentShow.duration = this.audioBuffer.duration;
          this.currentShow.audio.duration = this.audioBuffer.duration;

          // Compute peak across decoded channel data for full vertical scale
          const chData = this.audioBuffer.getChannelData(0);
          let peak = 0;
          const stride = Math.max(1, Math.floor(chData.length / 50000));
          for (let s = 0; s < chData.length; s += stride) {
            const v = Math.abs(chData[s]);
            if (v > peak) peak = v;
          }
          this.audioBufferPeak = peak > 0.02 ? peak : 1.0;
        }
        this.dom.audioStatusBadge.textContent = "✅ Bereit (Datei)";
        this.renderTimeline();
        return;
      } catch (err) {
        console.warn("Local file decode warning:", err);
      }
    }

    // For Music Assistant items (Plex, Jellyfin, Navidrome, SMB, streams): instant synthetic rhythm waveform
    this.audioBuffer = null;
    this.audioBufferPeak = null;
    if (fallbackDuration && (!this.currentShow.duration || this.currentShow.duration <= 0)) {
      this.currentShow.duration = fallbackDuration;
    }
    this.dom.audioStatusBadge.textContent = "✅ Bereit (Music Assistant)";
    this.dom.audioStatusBadge.className = "badge badge-wled";
    this.renderTimeline();
  }

  drawWaveform(width) {
    const canvas = this.dom.waveformCanvas;
    const ctx = canvas.getContext("2d");
    const height = canvas.height || 120;
    ctx.clearRect(0, 0, width, height);

    const hasAudio = !!(this.currentShow.audio.stream_url || this.currentShow.audio.mass_uri || this.currentShow.audio.filename);

    if (!hasAudio) {
      ctx.fillStyle = "#10141f";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#64748b";
      ctx.font = "500 13px Inter, sans-serif";
      ctx.fillText("🎵 Kein Audio geladen – Wähle oben einen Song aus Music Assistant oder lade eine MP3 hoch", 24, Math.round(height / 2) + 5);
      return;
    }

    const mid = height / 2;

    // Glowing vibrant neon gradient matching DAW aesthetic (cyan top to magenta bottom)
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#00e5ff");    // Vibrant cyan peak
    grad.addColorStop(0.35, "#38bdf8"); // Sky blue
    grad.addColorStop(0.5, "#a855f7");  // Electric violet center
    grad.addColorStop(0.7, "#ec4899");  // Neon Pink
    grad.addColorStop(1, "#f43f5e");    // Hot Rose bottom peak
    ctx.fillStyle = grad;

    // Total active audio duration in seconds
    const audioDur = this.audioBuffer?.duration || this.currentShow.audio?.duration || this.currentShow.duration || 240.0;
    const maxAudioPx = Math.ceil(audioDur * this.zoom);

    if (this.audioBuffer) {
      // 1. REAL DECODED AUDIO WAVEFORM (100% time-synced to x = time * this.zoom)
      const channelData = this.audioBuffer.getChannelData(0);
      const sampleRate = this.audioBuffer.sampleRate;
      const totalSamples = channelData.length;
      const norm = 0.97 / (this.audioBufferPeak || 1.0);
      const stepPx = 2; // high-resolution 2px bar width

      for (let x = 0; x < width; x += stepPx) {
        if (x > maxAudioPx) break;

        const t0 = x / this.zoom;
        const t1 = (x + stepPx) / this.zoom;
        const s0 = Math.floor(t0 * sampleRate);
        const s1 = Math.min(totalSamples, Math.ceil(t1 * sampleRate));

        let min = 0.0;
        let max = 0.0;
        if (s1 > s0) {
          const sampleCount = s1 - s0;
          const subStep = Math.max(1, Math.floor(sampleCount / 30));
          for (let s = s0; s < s1; s += subStep) {
            const d = channelData[s];
            if (d < min) min = d;
            if (d > max) max = d;
          }
        }

        // Full-height scaling: peaks reach 97% of lane height
        const maxVal = Math.min(0.97, Math.abs(max) * norm);
        const minVal = Math.min(0.97, Math.abs(min) * norm);
        const top = Math.max(1, Math.round(mid - (maxVal * mid)));
        const bottom = Math.min(height - 1, Math.round(mid + (minVal * mid)));
        const barH = Math.max(2, bottom - top);

        ctx.fillRect(x, top, stepPx - 0.5, barH);
      }
    } else {
      // 2. SYNTHETIC RHYTHMIC WAVEFORM (Music Assistant streams: 100% time-synced to x = time * this.zoom)
      const stepPx = 3;

      for (let x = 0; x < width; x += stepPx) {
        const timeAtX = x / this.zoom;
        if (timeAtX > audioDur) break;

        // Synchronized beats: quarter note kicks (2Hz @ 120bpm), 8th notes, measure downbeats
        const beatQuarter = Math.abs(Math.sin(timeAtX * Math.PI * 2));
        const beatEighth = Math.abs(Math.sin(timeAtX * Math.PI * 4));
        const beatMeasure = Math.abs(Math.sin(timeAtX * Math.PI * 0.5));

        // Deterministic pseudo-random variation hash derived strictly from time
        const bucket = Math.floor(timeAtX * 4);
        const hash = Math.abs(Math.sin(bucket * 12.9898 + 78.233) * 43758.5453) % 1;

        const rawAmp = 0.38 + 0.35 * beatQuarter + 0.15 * beatMeasure + 0.12 * hash;
        const amp = Math.max(0.12, Math.min(0.97, rawAmp));

        // Fill the entire track height!
        const barH = Math.max(4, Math.round(amp * (height * 0.95)));
        const top = Math.round(mid - (barH / 2));
        ctx.fillRect(x, top, stepPx - 0.8, barH);
      }
    }

    // Center zero-crossing midline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();

    // Subtle ceiling/floor boundary lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.lineTo(width, 1);
    ctx.moveTo(0, height - 1);
    ctx.lineTo(width, height - 1);
    ctx.stroke();

    // End-of-Audio line marker if song ends before timeline margin
    if (maxAudioPx > 0 && maxAudioPx < width) {
      ctx.strokeStyle = "rgba(0, 210, 255, 0.45)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(maxAudioPx, 0);
      ctx.lineTo(maxAudioPx, height);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 10px 'JetBrains Mono', monospace";
      ctx.fillText(`⏹ Song-Ende (${this.formatTime(audioDur)})`, maxAudioPx + 8, mid + 3);
    }
  }

  showHud(x, y, badgeType, badgeText, valHtml) {
    if (!this.dom.cueHud) return;
    const badgeClass = badgeType === "resize" ? "hud-badge-resize" : (badgeType === "clone" ? "hud-badge-clone" : "hud-badge-move");
    this.dom.cueHud.innerHTML = `
      <span class="hud-badge ${badgeClass}">${badgeText}</span>
      <span class="hud-val">${valHtml}</span>
    `;
    this.dom.cueHud.style.left = `${x}px`;
    this.dom.cueHud.style.top = `${y}px`;
    this.dom.cueHud.classList.remove("hidden");
  }

  hideHud() {
    if (this.dom.cueHud) {
      this.dom.cueHud.classList.add("hidden");
    }
  }

  selectCue(trackId, cueIdx) {
    this.selectedCueRef = { trackId, cueIdx };
    document.querySelectorAll(".cue-block").forEach(el => {
      const isMatch = el.dataset.trackId === trackId && parseInt(el.dataset.cueIdx, 10) === cueIdx;
      el.classList.toggle("selected", isMatch);
    });
  }

  deselectCue() {
    this.selectedCueRef = null;
    document.querySelectorAll(".cue-block.selected").forEach(el => el.classList.remove("selected"));
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
      trackRow.dataset.trackId = track.id;

      // Left Header
      const header = document.createElement("div");
      header.className = "track-header";
      
      const isWled = track.type === "wled";
      const defaultFadeIn = track.default_fade_in !== undefined ? track.default_fade_in : 0.0;
      const defaultFadeOut = track.default_fade_out !== undefined ? track.default_fade_out : 0.5;

      header.innerHTML = `
        <div>
          <div class="track-header-top">
            <div class="track-title-row">
              <span class="lamp-status-dot" id="dot-${track.id}"></span>
              <span class="track-name" title="${track.name}">${track.name}</span>
            </div>
            <div class="track-actions-top">
              <button class="btn-track-settings" data-action="settings" title="Lampen-Einstellungen öffnen (Fade In / Out Zeiten separat, Name)">⚙️</button>
              <button class="btn btn-micro btn-danger" title="Spur entfernen" data-action="del-track">✕</button>
            </div>
          </div>
          <div class="track-sub-row">
            <span class="badge ${isWled ? 'badge-wled' : 'badge-zigbee'}">${isWled ? 'WLED' : 'Standard'}</span>
            <button class="badge-fade-btn" data-action="settings" title="Klicken für separate Fade In/Out Einstellungen dieser Lampe">
              ↗ ${Number(defaultFadeIn).toFixed(1)}s | ↘ ${Number(defaultFadeOut).toFixed(1)}s
            </button>
          </div>
          <div class="track-controls-bar">
            <button class="btn-track-toggle" data-action="toggle-live" title="Lampe jetzt sofort an-/ausschalten">⏻ Schalten</button>
            <button class="btn-track-cue" data-action="add-cue-cursor" title="Keyframe an Cursorposition einfügen">+ Cue (${this.currentTime.toFixed(1)}s)</button>
          </div>
        </div>
      `;

      // Open Lamp Settings Modal
      header.querySelectorAll('[data-action="settings"]').forEach(btn => {
        btn.addEventListener("click", () => this.openLampSettings(track.id));
      });

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
      lane.style.minWidth = `${timelineWidth}px`;
      lane.title = "Klicken, um an dieser Stelle einen Keyframe (Cue) zu setzen | Rechtsklick für Menü";

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

      // Right-click on empty space: Lane context menu
      lane.addEventListener("contextmenu", (e) => {
        if (e.target.closest(".cue-block")) return;
        e.preventDefault();
        const rect = lane.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        let time = clickX / this.zoom;
        if (this.snap > 0) {
          time = Math.round(time / this.snap) * this.snap;
        }
        time = Math.max(0, parseFloat(time.toFixed(2)));
        this.showLaneContextMenu(e.clientX, e.clientY, track, time);
      });

      // Render Cues with Dual Handles, Smooth Resizing, Drag & Drop, and Visual Lamp State
      track.cues.forEach((cue, cueIdx) => {
        const cueEl = document.createElement("div");
        cueEl.className = "cue-block";
        cueEl.dataset.trackId = track.id;
        cueEl.dataset.cueIdx = cueIdx;
        cueEl.dataset.time = cue.time;
        const dur = cue.duration !== undefined ? cue.duration : 2.0;
        cueEl.dataset.duration = dur;

        if (cue.state === "off") cueEl.classList.add("cue-off");
        if (this.selectedCueRef && this.selectedCueRef.trackId === track.id && this.selectedCueRef.cueIdx === cueIdx) {
          cueEl.classList.add("selected");
        }

        const leftPx = cue.time * this.zoom;
        const widthPx = Math.max(26, dur * this.zoom);
        cueEl.style.left = `${leftPx}px`;
        cueEl.style.width = `${widthPx}px`;

        // Apply planned visual lamp state & multicolor styles
        const vStyle = this.getCueVisualStyle(cue);
        cueEl.style.background = vStyle.background;
        cueEl.style.borderColor = vStyle.borderColor;
        cueEl.style.borderStyle = vStyle.borderStyle;
        cueEl.style.color = vStyle.textColor;
        cueEl.style.boxShadow = vStyle.glow;

        const isOff = cue.state === "off";
        const swatchHtml = (!isOff && vStyle.baseColor)
          ? `<span class="cue-swatch-dot" style="background: ${vStyle.baseColor};"></span>`
          : `<span class="cue-swatch-dot cue-swatch-off"></span>`;

        cueEl.innerHTML = `
          <div class="cue-handle-left" title="Linken Rand ziehen: Startzeit anpassen (Shift für feines Ziehen)"></div>
          <div class="cue-drag-body" title="Ziehen zum Verschieben | Rechtsklick für Menü (Löschen, Kopieren, Farben) | Doppelklick für Inspector">
            <div class="cue-title-row">
              ${swatchHtml}
              <span class="cue-label" style="text-shadow: ${vStyle.textShadow}">${vStyle.icon}</span>
            </div>
            <span class="cue-sub" style="color: ${vStyle.textColor};">${cue.time.toFixed(2)}s | ${dur.toFixed(1)}s</span>
          </div>
          <div class="cue-handle-right" title="Rechten Rand ziehen: Dauer anpassen (Shift für feines Ziehen)"></div>
        `;

        // Context menu on right click
        cueEl.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.selectCue(track.id, cueIdx);
          this.showCueContextMenu(e.clientX, e.clientY, track, cue, cueIdx);
        });

        // 1. LEFT RESIZE HANDLE (Adjust Start Time & Duration, Keep End Point Fixed)
        const handleLeft = cueEl.querySelector(".cue-handle-left");
        let leftStartX = 0;
        let leftOrigTime = cue.time;
        let leftOrigDur = dur;
        let leftFixedEndTime = leftOrigTime + leftOrigDur;

        const onLeftResizeMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - leftStartX;
          let newStartTime = leftOrigTime + deltaX / this.zoom;
          if (!moveEvent.shiftKey && this.snap > 0) {
            newStartTime = Math.round(newStartTime / this.snap) * this.snap;
          }
          newStartTime = Math.max(0, Math.min(newStartTime, leftFixedEndTime - 0.1));
          const newDur = Math.max(0.1, parseFloat((leftFixedEndTime - newStartTime).toFixed(2)));
          newStartTime = parseFloat(newStartTime.toFixed(2));

          cue.time = newStartTime;
          cue.duration = newDur;
          cueEl.style.left = `${newStartTime * this.zoom}px`;
          cueEl.style.width = `${Math.max(20, newDur * this.zoom)}px`;
          cueEl.dataset.time = newStartTime;
          cueEl.dataset.duration = newDur;

          const sub = cueEl.querySelector(".cue-sub");
          if (sub) sub.textContent = `${newStartTime.toFixed(2)}s | ${newDur.toFixed(1)}s an`;

          this.showHud(moveEvent.clientX, moveEvent.clientY, "resize", "↔ Startzeit", `Start: ${newStartTime.toFixed(2)}s | Dauer: ${newDur.toFixed(2)}s | Ende: ${leftFixedEndTime.toFixed(2)}s`);
        };

        const onLeftResizeUp = () => {
          window.removeEventListener("mousemove", onLeftResizeMove);
          window.removeEventListener("mouseup", onLeftResizeUp);
          handleLeft.classList.remove("resizing");
          this.hideHud();
          track.cues.sort((a, b) => a.time - b.time);
          this.selectedCueRef = { trackId: track.id, cueIdx: track.cues.indexOf(cue) };
          this.renderTimeline();
        };

        handleLeft.addEventListener("mousedown", (downEvent) => {
          if (downEvent.button !== 0) return;
          downEvent.stopPropagation();
          leftStartX = downEvent.clientX;
          leftOrigTime = cue.time;
          leftOrigDur = cue.duration !== undefined ? cue.duration : 2.0;
          leftFixedEndTime = leftOrigTime + leftOrigDur;
          handleLeft.classList.add("resizing");

          window.addEventListener("mousemove", onLeftResizeMove);
          window.addEventListener("mouseup", onLeftResizeUp);
        });

        // 2. RIGHT RESIZE HANDLE (Adjust Duration, Keep Start Fixed)
        const handleRight = cueEl.querySelector(".cue-handle-right");
        let rightStartX = 0;
        let rightOrigDur = dur;

        const onRightResizeMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - rightStartX;
          let newDur = rightOrigDur + deltaX / this.zoom;
          if (!moveEvent.shiftKey && this.snap > 0) {
            newDur = Math.round(newDur / this.snap) * this.snap;
          }
          newDur = Math.max(0.1, parseFloat(newDur.toFixed(2)));

          cue.duration = newDur;
          cueEl.style.width = `${Math.max(20, newDur * this.zoom)}px`;
          cueEl.dataset.duration = newDur;

          const sub = cueEl.querySelector(".cue-sub");
          if (sub) sub.textContent = `${cue.time.toFixed(2)}s | ${newDur.toFixed(1)}s an`;

          this.showHud(moveEvent.clientX, moveEvent.clientY, "resize", "↔ Dauer", `Dauer: ${newDur.toFixed(2)}s | Ende: ${(cue.time + newDur).toFixed(2)}s`);
        };

        const onRightResizeUp = () => {
          window.removeEventListener("mousemove", onRightResizeMove);
          window.removeEventListener("mouseup", onRightResizeUp);
          handleRight.classList.remove("resizing");
          this.hideHud();
          this.renderTimeline();
        };

        handleRight.addEventListener("mousedown", (downEvent) => {
          if (downEvent.button !== 0) return;
          downEvent.stopPropagation();
          rightStartX = downEvent.clientX;
          rightOrigDur = cue.duration !== undefined ? cue.duration : 2.0;
          handleRight.classList.add("resizing");

          window.addEventListener("mousemove", onRightResizeMove);
          window.addEventListener("mouseup", onRightResizeUp);
        });

        // 3. CENTER DRAG BODY (Move / Alt+Duplicate / Inter-Track Transfer)
        const dragBody = cueEl.querySelector(".cue-drag-body");
        let bodyStartX = 0;
        let bodyStartY = 0;
        let bodyOrigTime = cue.time;
        let hasMoved = false;
        let isCloning = false;
        let activeCue = cue;
        let hoverTargetTrackId = null;

        const onBodyMouseMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - bodyStartX;
          const deltaY = moveEvent.clientY - bodyStartY;
          if (Math.hypot(deltaX, deltaY) > 3) hasMoved = true;
          if (!hasMoved) return;

          cueEl.classList.add("dragging");
          let newTime = Math.max(0, bodyOrigTime + deltaX / this.zoom);
          if (!moveEvent.shiftKey && this.snap > 0) {
            newTime = Math.round(newTime / this.snap) * this.snap;
          }
          newTime = Math.max(0, parseFloat(newTime.toFixed(2)));
          activeCue.time = newTime;
          cueEl.style.left = `${newTime * this.zoom}px`;
          cueEl.dataset.time = newTime;

          const sub = cueEl.querySelector(".cue-sub");
          if (sub) sub.textContent = `${newTime.toFixed(2)}s | ${(activeCue.duration || 2.0).toFixed(1)}s an`;

          // Check vertical hover track
          document.querySelectorAll(".light-track-row.drop-target").forEach(el => el.classList.remove("drop-target"));
          const hoverEls = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY) || [];
          const targetRow = hoverEls.find(el => el.classList && el.classList.contains("light-track-row"));
          
          let targetTrackName = "";
          if (targetRow && targetRow.dataset.trackId) {
            hoverTargetTrackId = targetRow.dataset.trackId;
            targetRow.classList.add("drop-target");
            const targetTrack = this.currentShow.tracks.find(t => t.id === hoverTargetTrackId);
            if (targetTrack && targetTrack.id !== track.id) {
              targetTrackName = ` ➔ ${targetTrack.name}`;
            }
          } else {
            hoverTargetTrackId = null;
          }

          const badgeType = isCloning ? "clone" : "move";
          const badgeText = isCloning ? "➕ Duplizieren" : "✥ Verschieben";
          this.showHud(moveEvent.clientX, moveEvent.clientY, badgeType, badgeText, `Zeit: ${newTime.toFixed(2)}s (Dauer: ${(activeCue.duration || 2.0).toFixed(1)}s)${targetTrackName}`);
        };

        const onBodyMouseUp = () => {
          window.removeEventListener("mousemove", onBodyMouseMove);
          window.removeEventListener("mouseup", onBodyMouseUp);
          cueEl.classList.remove("dragging");
          document.querySelectorAll(".light-track-row.drop-target").forEach(el => el.classList.remove("drop-target"));
          this.hideHud();

          if (hasMoved) {
            // If dropped on another track, transfer cue!
            if (hoverTargetTrackId && hoverTargetTrackId !== track.id) {
              const targetTrack = this.currentShow.tracks.find(t => t.id === hoverTargetTrackId);
              if (targetTrack) {
                if (!isCloning) {
                  const srcIdx = track.cues.indexOf(activeCue);
                  if (srcIdx !== -1) track.cues.splice(srcIdx, 1);
                }
                targetTrack.cues.push(activeCue);
                targetTrack.cues.sort((a, b) => a.time - b.time);
                this.selectedCueRef = { trackId: targetTrack.id, cueIdx: targetTrack.cues.indexOf(activeCue) };
                this.renderTimeline();
                return;
              }
            }

            track.cues.sort((a, b) => a.time - b.time);
            this.selectedCueRef = { trackId: track.id, cueIdx: track.cues.indexOf(activeCue) };
            this.renderTimeline();
          } else {
            // Click without movement: select cue
            this.selectCue(track.id, cueIdx);
          }
        };

        dragBody.addEventListener("mousedown", (downEvent) => {
          if (downEvent.button !== 0) return;
          downEvent.stopPropagation();
          bodyStartX = downEvent.clientX;
          bodyStartY = downEvent.clientY;
          hasMoved = false;
          hoverTargetTrackId = null;

          // Alt-Key duplicate / clone
          if (downEvent.altKey) {
            isCloning = true;
            const cloned = JSON.parse(JSON.stringify(cue));
            track.cues.push(cloned);
            activeCue = cloned;
            bodyOrigTime = cloned.time;
          } else {
            isCloning = false;
            activeCue = cue;
            bodyOrigTime = cue.time;
          }

          window.addEventListener("mousemove", onBodyMouseMove);
          window.addEventListener("mouseup", onBodyMouseUp);
        });

        // Double-click opens inspector
        dragBody.addEventListener("dblclick", (e) => {
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

    const defaultFadeIn = track.default_fade_in !== undefined ? track.default_fade_in : (track.type === "wled" ? 0.0 : 0.0);
    const defaultFadeOut = track.default_fade_out !== undefined ? track.default_fade_out : 0.5;

    const newCue = {
      time: Math.max(0, parseFloat(time.toFixed(2))),
      duration: 2.0,
      state: "on",
      brightness: 255,
      rgb_color: [255, 0, 100],
      fade_in: defaultFadeIn,
      fade_out: defaultFadeOut,
      transition: defaultFadeIn,
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

    const defaultFadeIn = track.default_fade_in !== undefined ? track.default_fade_in : 0.0;
    const defaultFadeOut = track.default_fade_out !== undefined ? track.default_fade_out : 0.5;
    const fadeIn = cue.fade_in !== undefined ? cue.fade_in : (cue.transition !== undefined ? cue.transition : defaultFadeIn);
    const fadeOut = cue.fade_out !== undefined ? cue.fade_out : defaultFadeOut;

    if (this.dom.cueFadeInInput) this.dom.cueFadeInInput.value = fadeIn;
    if (this.dom.cueFadeOutInput) this.dom.cueFadeOutInput.value = fadeOut;
    if (this.dom.cueTransitionInput) this.dom.cueTransitionInput.value = fadeIn;

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

    const fadeIn = this.dom.cueFadeInInput ? (parseFloat(this.dom.cueFadeInInput.value) || 0.0) : (parseFloat(this.dom.cueTransitionInput?.value) || 0.0);
    const fadeOut = this.dom.cueFadeOutInput ? (parseFloat(this.dom.cueFadeOutInput.value) || 0.0) : 0.5;
    
    if (cue.state === "on") {
      cue.brightness = parseInt(this.dom.cueBrightnessSlider.value, 10);
      cue.rgb_color = this.hexToRgb(this.dom.cueColorPicker.value);
      cue.fade_in = fadeIn;
      cue.fade_out = fadeOut;
      cue.transition = fadeIn;
      cue.effect = this.dom.cueEffectSelect.value || "";
    } else {
      cue.fade_out = fadeOut;
      cue.transition = fadeOut;
    }

    track.cues.sort((a, b) => a.time - b.time);
    this.closeInspector();
    this.renderTimeline();
  }

  deleteSelectedCue() {
    if (!this.selectedCueRef) return;
    const { trackId, cueIdx } = this.selectedCueRef;
    this.deleteCue(trackId, cueIdx);
  }

  deleteCue(trackId, cueIdx) {
    const track = this.currentShow.tracks.find(t => t.id === trackId);
    if (!track || !track.cues[cueIdx]) return;
    track.cues.splice(cueIdx, 1);
    this.closeInspector();
    this.deselectCue();
    this.renderTimeline();
    this.showToast("🗑️ Segment gelöscht");
  }

  copyCue(cue) {
    if (!cue) return;
    this.clipboardCue = JSON.parse(JSON.stringify(cue));
    this.showToast("📋 Segment kopiert!");
  }

  duplicateCue(trackId, cueIdx) {
    const track = this.currentShow.tracks.find(t => t.id === trackId);
    if (!track || !track.cues[cueIdx]) return;
    const origCue = track.cues[cueIdx];
    const dur = origCue.duration !== undefined ? origCue.duration : 2.0;
    const cloned = JSON.parse(JSON.stringify(origCue));
    cloned.time = parseFloat((origCue.time + dur + 0.05).toFixed(2));
    track.cues.push(cloned);
    track.cues.sort((a, b) => a.time - b.time);
    this.selectedCueRef = { trackId, cueIdx: track.cues.indexOf(cloned) };
    this.renderTimeline();
    this.showToast("📑 Segment dupliziert!");
  }

  pasteCueAt(trackId, targetTime) {
    if (!this.clipboardCue) return;
    const track = this.currentShow.tracks.find(t => t.id === trackId);
    if (!track) return;
    const pasted = JSON.parse(JSON.stringify(this.clipboardCue));
    pasted.time = Math.max(0, parseFloat(targetTime.toFixed(2)));
    track.cues.push(pasted);
    track.cues.sort((a, b) => a.time - b.time);
    this.selectedCueRef = { trackId, cueIdx: track.cues.indexOf(pasted) };
    this.renderTimeline();
    this.showToast("📋 Segment eingefügt!");
  }

  getCueVisualStyle(cue) {
    if (cue.state === "off") {
      return {
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        borderColor: "rgba(148, 163, 184, 0.4)",
        borderStyle: "dashed",
        textColor: "#94a3b8",
        glow: "none",
        icon: "⏻ AUS",
        baseColor: null,
        textShadow: "none"
      };
    }

    if (cue.effect) {
      return {
        background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #06b6d4 100%)",
        borderColor: "#f43f5e",
        borderStyle: "solid",
        textColor: "#ffffff",
        glow: "0 0 16px rgba(236, 72, 153, 0.45)",
        icon: `✨ ${cue.effect}`,
        baseColor: "#ec4899",
        textShadow: "0 1px 3px rgba(0,0,0,0.9)"
      };
    }

    // Planned RGB Lamp Color
    let r = 255, g = 255, b = 255;
    if (cue.rgb_color && Array.isArray(cue.rgb_color) && cue.rgb_color.length === 3) {
      [r, g, b] = cue.rgb_color;
    } else if (cue.color_temp) {
      const t = Math.max(0, Math.min(1, (cue.color_temp - 153) / (500 - 153)));
      r = 255;
      g = Math.round(220 - t * 60);
      b = Math.round(255 - t * 205);
    } else {
      r = 0; g = 210; b = 255;
    }

    const brightness = cue.brightness !== undefined ? cue.brightness : 255;
    const briRatio = Math.max(0.15, brightness / 255);
    const alpha = (0.35 + 0.65 * briRatio).toFixed(2);

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const textColor = (lum > 145 && briRatio > 0.4) ? "#070b12" : "#ffffff";
    const textShadow = (lum > 145 && briRatio > 0.4) ? "none" : "0 1px 3px rgba(0,0,0,0.9)";

    const baseRgb = `rgb(${r}, ${g}, ${b})`;
    const glowRgb = `rgba(${r}, ${g}, ${b}, ${Math.min(0.65, briRatio * 0.75).toFixed(2)})`;
    const bgGradient = `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, ${alpha}) 0%, rgba(${Math.round(r * 0.65)}, ${Math.round(g * 0.65)}, ${Math.round(b * 0.65)}, ${alpha}) 100%)`;

    return {
      background: bgGradient,
      baseColor: baseRgb,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.9)`,
      borderStyle: "solid",
      textColor,
      textShadow,
      glow: `0 3px 14px ${glowRgb}`,
      icon: `💡 ${Math.round((brightness / 255) * 100)}%`,
    };
  }

  showCueContextMenu(x, y, track, cue, cueIdx) {
    const menu = this.dom.contextMenu;
    if (!menu) return;

    const dur = cue.duration !== undefined ? cue.duration : 2.0;
    const vStyle = this.getCueVisualStyle(cue);
    const isOff = cue.state === "off";

    menu.innerHTML = `
      <div class="menu-header">
        <span class="cue-swatch-dot ${isOff ? 'cue-swatch-off' : ''}" style="${vStyle.baseColor ? `background: ${vStyle.baseColor};` : ''}"></span>
        <span class="menu-title">${track.name}</span>
        <span class="menu-badge">${cue.time.toFixed(2)}s | ${dur.toFixed(1)}s</span>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="edit">
        <span class="menu-icon">✏️</span>
        <span class="menu-label">Segment bearbeiten</span>
        <span class="menu-shortcut">Doppelklick</span>
      </div>
      <div class="menu-item" data-action="copy">
        <span class="menu-icon">📋</span>
        <span class="menu-label">Kopieren</span>
        <span class="menu-shortcut">Strg+C</span>
      </div>
      <div class="menu-item" data-action="duplicate">
        <span class="menu-icon">📑</span>
        <span class="menu-label">Duplizieren</span>
        <span class="menu-shortcut">Strg+D</span>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-sub-section">
        <span class="menu-sub-label">Lampenfarbe direkt wählen:</span>
        <div class="quick-colors-row">
          <button class="quick-color-btn" style="background: #ffffff;" data-color="255,255,255" title="Weiß"></button>
          <button class="quick-color-btn" style="background: #ff0055;" data-color="255,0,85" title="Rot/Neonpink"></button>
          <button class="quick-color-btn" style="background: #ff6600;" data-color="255,102,0" title="Orange"></button>
          <button class="quick-color-btn" style="background: #ffd000;" data-color="255,208,0" title="Warmes Gelb"></button>
          <button class="quick-color-btn" style="background: #00ff66;" data-color="0,255,102" title="Grün"></button>
          <button class="quick-color-btn" style="background: #00d2ff;" data-color="0,210,255" title="Cyan / Eisblau"></button>
          <button class="quick-color-btn" style="background: #2563eb;" data-color="37,99,235" title="Königsblau"></button>
          <button class="quick-color-btn" style="background: #a855f7;" data-color="168,85,247" title="Lila / Violett"></button>
        </div>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="toggle-state">
        <span class="menu-icon">${isOff ? '💡' : '⏻'}</span>
        <span class="menu-label">${isOff ? 'Lampe einschalten (An)' : 'Lampe ausschalten (Aus)'}</span>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="lamp-settings">
        <span class="menu-icon">⚙️</span>
        <span class="menu-label">Lampen-Einstellungen (Fade In/Out)...</span>
      </div>
      <div class="menu-item text-danger" data-action="delete">
        <span class="menu-icon">🗑️</span>
        <span class="menu-label">Segment löschen</span>
        <span class="menu-shortcut">Entf</span>
      </div>
    `;

    // Bind actions
    menu.querySelectorAll(".menu-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        if (action === "edit") {
          this.hideContextMenu();
          this.openInspector(track.id, cueIdx);
        } else if (action === "copy") {
          this.copyCue(cue);
          this.hideContextMenu();
        } else if (action === "duplicate") {
          this.duplicateCue(track.id, cueIdx);
          this.hideContextMenu();
        } else if (action === "toggle-state") {
          cue.state = isOff ? "on" : "off";
          if (cue.state === "on" && (!cue.rgb_color || cue.rgb_color.length !== 3)) {
            cue.rgb_color = [255, 0, 100];
          }
          this.hideContextMenu();
          this.renderTimeline();
          this.showToast(cue.state === "on" ? "💡 Segment auf AN geschaltet" : "⏻ Segment auf AUS geschaltet");
        } else if (action === "lamp-settings") {
          this.hideContextMenu();
          this.openLampSettings(track.id);
        } else if (action === "delete") {
          this.deleteCue(track.id, cueIdx);
          this.hideContextMenu();
        }
      });
    });

    // Quick colors
    menu.querySelectorAll(".quick-color-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const rgb = btn.dataset.color.split(",").map(Number);
        cue.state = "on";
        cue.rgb_color = rgb;
        if (!cue.brightness || cue.brightness <= 0) cue.brightness = 255;
        this.hideContextMenu();
        this.renderTimeline();
        this.showToast(`🎨 Farbe geändert: rgb(${rgb.join(",")})`);
      });
    });

    this.positionContextMenu(x, y);
  }

  showLaneContextMenu(x, y, track, clickTime) {
    const menu = this.dom.contextMenu;
    if (!menu) return;

    menu.innerHTML = `
      <div class="menu-header">
        <span class="menu-icon">💡</span>
        <span class="menu-title">${track.name}</span>
        <span class="menu-badge">bei ${clickTime.toFixed(2)}s</span>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="create">
        <span class="menu-icon">➕</span>
        <span class="menu-label">Neues Segment hier einfügen</span>
      </div>
      ${this.clipboardCue ? `
      <div class="menu-item" data-action="paste">
        <span class="menu-icon">📋</span>
        <span class="menu-label">Kopiertes Segment hier einfügen (${(this.clipboardCue.duration || 2.0).toFixed(1)}s)</span>
        <span class="menu-shortcut">Strg+V</span>
      </div>
      ` : ''}
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="seek">
        <span class="menu-icon">🎯</span>
        <span class="menu-label">Cursor hierher setzen (${clickTime.toFixed(2)}s)</span>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="lamp-settings">
        <span class="menu-icon">⚙️</span>
        <span class="menu-label">Lampen-Einstellungen (Fade In/Out)...</span>
      </div>
    `;

    menu.querySelectorAll(".menu-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        if (action === "create") {
          this.addCueToTrack(track.id, clickTime);
          this.hideContextMenu();
        } else if (action === "paste") {
          this.pasteCueAt(track.id, clickTime);
          this.hideContextMenu();
        } else if (action === "seek") {
          this.seek(clickTime);
          this.hideContextMenu();
        } else if (action === "lamp-settings") {
          this.hideContextMenu();
          this.openLampSettings(track.id);
        }
      });
    });

    this.positionContextMenu(x, y);
  }

  positionContextMenu(x, y) {
    const menu = this.dom.contextMenu;
    menu.classList.remove("hidden");
    const menuWidth = menu.offsetWidth || 230;
    const menuHeight = menu.offsetHeight || 260;

    let posX = x + 2;
    let posY = y + 2;

    if (posX + menuWidth > window.innerWidth - 10) {
      posX = window.innerWidth - menuWidth - 10;
    }
    if (posY + menuHeight > window.innerHeight - 10) {
      posY = window.innerHeight - menuHeight - 10;
    }

    menu.style.left = `${Math.max(10, posX)}px`;
    menu.style.top = `${Math.max(10, posY)}px`;
  }

  hideContextMenu() {
    if (this.dom.contextMenu) {
      this.dom.contextMenu.classList.add("hidden");
    }
  }

  showToast(message) {
    const container = this.dom.toastContainer || document.body;
    const toast = document.createElement("div");
    toast.className = "daw-toast";
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(12px)";
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }

  async testSelectedCueLive() {
    if (!this.selectedCueRef) return;
    const { trackId } = this.selectedCueRef;
    const track = this.currentShow.tracks.find(t => t.id === trackId);
    if (!track) return;

    const isOn = this.dom.cueStateOn.classList.contains("active");
    const fadeIn = this.dom.cueFadeInInput ? (parseFloat(this.dom.cueFadeInInput.value) || 0.0) : 0.0;
    const fadeOut = this.dom.cueFadeOutInput ? (parseFloat(this.dom.cueFadeOutInput.value) || 0.0) : 0.5;

    const cuePayload = {
      state: isOn ? "on" : "off",
      brightness: parseInt(this.dom.cueBrightnessSlider.value, 10),
      rgb_color: this.hexToRgb(this.dom.cueColorPicker.value),
      fade_in: fadeIn,
      fade_out: fadeOut,
      transition: isOn ? fadeIn : fadeOut,
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

  // --- LAMP SETTINGS MODAL ---

  openLampSettings(trackId) {
    const track = this.currentShow.tracks.find(t => t.id === trackId);
    if (!track) return;

    this.activeLampTrackId = trackId;
    if (this.dom.lampNameInput) this.dom.lampNameInput.value = track.name || "";
    if (this.dom.lampEntityDisplay) this.dom.lampEntityDisplay.textContent = track.entity_id || "-";
    if (this.dom.lampFadeInInput) this.dom.lampFadeInInput.value = track.default_fade_in !== undefined ? track.default_fade_in : 0.0;
    if (this.dom.lampFadeOutInput) this.dom.lampFadeOutInput.value = track.default_fade_out !== undefined ? track.default_fade_out : 0.5;
    if (this.dom.lampApplyExistingCues) this.dom.lampApplyExistingCues.checked = false;

    if (this.dom.lampModal) {
      this.dom.lampModal.classList.remove("hidden");
    }
  }

  closeLampSettings() {
    this.activeLampTrackId = null;
    if (this.dom.lampModal) {
      this.dom.lampModal.classList.add("hidden");
    }
  }

  saveLampSettings() {
    if (!this.activeLampTrackId) return;
    const track = this.currentShow.tracks.find(t => t.id === this.activeLampTrackId);
    if (!track) return;

    if (this.dom.lampNameInput && this.dom.lampNameInput.value.trim()) {
      track.name = this.dom.lampNameInput.value.trim();
    }
    const fadeIn = Math.max(0, parseFloat(this.dom.lampFadeInInput?.value) || 0.0);
    const fadeOut = Math.max(0, parseFloat(this.dom.lampFadeOutInput?.value) || 0.0);
    track.default_fade_in = fadeIn;
    track.default_fade_out = fadeOut;

    if (this.dom.lampApplyExistingCues && this.dom.lampApplyExistingCues.checked) {
      (track.cues || []).forEach(c => {
        c.fade_in = fadeIn;
        c.fade_out = fadeOut;
        c.transition = c.state === "on" ? fadeIn : fadeOut;
      });
      this.showToast(`⚙️ Einstellungen gespeichert & auf ${track.cues.length} Segmente angewendet!`);
    } else {
      this.showToast("⚙️ Lampen-Einstellungen gespeichert!");
    }

    this.closeLampSettings();
    this.renderTimeline();
  }

  async testLampLive() {
    if (!this.activeLampTrackId) return;
    const track = this.currentShow.tracks.find(t => t.id === this.activeLampTrackId);
    if (!track) return;

    const fadeIn = Math.max(0, parseFloat(this.dom.lampFadeInInput?.value) || 0.0);
    try {
      await fetch(`${this.apiBase}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_cue",
          entity_id: track.entity_id,
          cue: {
            state: "on",
            brightness: 255,
            rgb_color: [255, 255, 255],
            transition: fadeIn,
            fade_in: fadeIn,
          }
        })
      });
      this.showToast(`💡 Test: ${track.name} mit Fade In ${fadeIn}s eingeschaltet`);
    } catch (e) {
      console.warn("Test lamp error:", e);
    }
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
    if (!url) {
      this.currentShow.audio.stream_url = null;
      this.currentShow.audio.mass_uri = "";
      this.currentShow.audio.filename = "";
      this.currentShow.audio.title = "";
      this.renderShow();
      return;
    }
    if (url === this.currentShow.audio.mass_uri) {
      return;
    }
    this.currentShow.audio.stream_url = url;
    const file = this.audioFiles.find(f => f.url === url);
    if (file) {
      this.currentShow.audio.filename = file.filename;
      this.currentShow.audio.title = file.filename.replace(/\.[^/.]+$/, "");
      this.currentShow.audio.mass_uri = "";
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
        const fileUrl = data.url || (data.filename ? `/api/lightshow/audio/${data.filename}` : null);
        if (fileUrl) {
          this.handleAudioSelect(fileUrl);
          this.setPlayMode("browser");
        }
      } else {
        alert("Upload fehlgeschlagen: " + (data.error || "Unbekannter Fehler"));
        this.renderShow();
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
      if (this.dom.audioDelayInput) {
        this.currentShow.settings.audio_delay_ms = parseInt(this.dom.audioDelayInput.value, 10) || 0;
      }

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

    // Determine target player (from dropdown or show settings)
    let selectedPlayer = this.dom.playerSelect?.value || this.currentShow.settings.default_player_entity_id;

    // Auto-select first available player if none selected
    if (!selectedPlayer && this.players && this.players.length > 0) {
      selectedPlayer = this.players[0].entity_id;
      if (this.dom.playerSelect) this.dom.playerSelect.value = selectedPlayer;
      this.currentShow.settings.default_player_entity_id = selectedPlayer;
    }

    if (!selectedPlayer) {
      alert("Bitte wähle oben einen Lautsprecher aus, über den Music Assistant die Musik abspielen soll!");
      return;
    }

    const audioDelayMs = parseInt(this.dom.audioDelayInput?.value, 10) || 0;
    this.currentShow.settings.default_player_entity_id = selectedPlayer;
    this.currentShow.settings.loop = this.isLooping;
    this.currentShow.settings.audio_delay_ms = audioDelayMs;

    this.playbackStartedAt = performance.now();
    this.playStartTime = this.playbackStartedAt;
    this.playStartPos = this.currentTime;
    this.lastTickTime = this.playbackStartedAt;
    this.audioDelaySec = audioDelayMs / 1000.0;

    // Start or resume playback through Music Assistant engine
    try {
      const isQuickResume = this.isPaused && Math.abs(this.currentTime - (this.pausedAtTime || 0)) < 0.2;
      const res = await fetch(`${this.apiBase}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isQuickResume ? {
          action: "resume"
        } : {
          action: "play",
          show_id: this.currentShow.id,
          show_data: this.currentShow,
          player_entity_id: selectedPlayer,
          start_time: this.currentTime,
          loop: this.isLooping,
          audio_delay_ms: audioDelayMs,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        console.warn("Backend play note:", data.error);
      }
    } catch (err) {
      console.warn("Control play call warning:", err);
    }

    // Optional browser local playback if user loaded an uploaded MP3 file directly
    if (this.dom.audioPlayer && this.currentShow.audio.stream_url && this.currentShow.audio.stream_url.startsWith("/api/lightshow/audio/")) {
      try {
        this.dom.audioPlayer.currentTime = this.currentTime;
        await this.dom.audioPlayer.play();
      } catch (e) {}
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.dom.btnPlay.style.display = "none";
    this.dom.btnPause.style.display = "flex";
    this.lastTickTime = performance.now();
    this.runPlaybackLoop();
  }

  async pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isPaused = true;
    this.pausedAtTime = this.currentTime;
    this.dom.btnPlay.style.display = "flex";
    this.dom.btnPause.style.display = "none";

    // Pause Music Assistant
    try {
      await fetch(`${this.apiBase}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
    } catch (e) {}

    if (this.dom.audioPlayer) {
      try { this.dom.audioPlayer.pause(); } catch (e) {}
    }

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
  }

  async stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.dom.btnPlay.style.display = "flex";
    this.dom.btnPause.style.display = "none";

    // Stop Music Assistant
    try {
      await fetch(`${this.apiBase}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
    } catch (e) {}

    if (this.dom.audioPlayer) {
      try {
        this.dom.audioPlayer.pause();
        this.dom.audioPlayer.currentTime = 0;
      } catch (e) {}
    }

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    // Cleanly reset local UI timeline without sending seek to backend!
    this.currentTime = 0;
    this.updatePlayheadPosition();
    this.updateTimeDisplay();
  }

  async blackout() {
    // If playing, stop transport loop immediately
    if (this.isPlaying) {
      this.isPlaying = false;
      this.isPaused = false;
      this.dom.btnPlay.style.display = "flex";
      this.dom.btnPause.style.display = "none";
      if (this.dom.audioPlayer) {
        try {
          this.dom.audioPlayer.pause();
          this.dom.audioPlayer.currentTime = 0;
        } catch (e) {}
      }
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    }

    try {
      await fetch(`${this.apiBase}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "blackout",
          show_id: this.currentShow.id,
          entity_ids: (this.currentShow.tracks || []).map(t => t.entity_id).filter(Boolean),
        }),
      });
    } catch (err) {
      console.warn("Blackout API call error:", err);
    }

    // Instantly reset visual indicators
    document.querySelectorAll(".lamp-status-dot").forEach(dot => {
      dot.style.background = "#334155";
    });
    document.querySelectorAll(".btn-track-toggle").forEach(btn => {
      btn.classList.remove("on");
    });

    this.showToast("⏻ Blackout: Alle Lampen sofort ausgeschaltet!");
  }

  async seek(targetTime) {
    this.currentTime = Math.max(0, Math.min(targetTime, this.currentShow.duration || 60));
    if (this.isPaused) {
      this.pausedAtTime = this.currentTime;
    }
    if (this.dom.audioPlayer && this.dom.audioPlayer.src) {
      try { this.dom.audioPlayer.currentTime = this.currentTime; } catch (e) {}
    }
    this.updatePlayheadPosition();
    this.updateTimeDisplay();

    // Only send seek command to backend while actively playing!
    // When paused or stopped, seeking only moves the timeline cursor.
    // When the user hits Play, play() will pass start_time: this.currentTime!
    if (this.isPlaying) {
      this.playStartPos = this.currentTime;
      this.playStartTime = performance.now();
      this.audioDelaySec = 0;
      try {
        await fetch(`${this.apiBase}/control`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "seek", time: this.currentTime }),
        });
      } catch (e) {}
    }
  }

  runPlaybackLoop() {
    if (!this.isPlaying) return;

    const now = performance.now();
    const elapsedSec = (now - (this.playStartTime || now)) / 1000;
    const effectiveSec = elapsedSec - (this.audioDelaySec || 0);

    if (effectiveSec < 0) {
      this.currentTime = this.playStartPos !== undefined ? this.playStartPos : 0;
    } else {
      this.currentTime = (this.playStartPos !== undefined ? this.playStartPos : 0) + effectiveSec;
    }

    // Check end of show
    if (this.currentTime >= (this.currentShow.duration || 60)) {
      if (this.isLooping) {
        this.seek(0);
      } else {
        this.stop();
        return;
      }
    }

    this.updatePlayheadPosition();
    this.updateTimeDisplay();
    this.animFrameId = requestAnimationFrame(() => this.runPlaybackLoop());
  }

  startBackendStatusSync() {
    // Poll backend status periodically to keep timeline in lockstep with Music Assistant
    setInterval(async () => {
      if (!this.isPlaying) return;
      try {
        const res = await fetch(`${this.apiBase}/status`);
        const data = await res.json();
        const elapsedSinceStart = performance.now() - (this.playbackStartedAt || 0);

        if (data && data.state === "playing" && typeof data.current_time === "number") {
          // If backend reports audio duration that is longer than loaded show duration, update timeline
          if (typeof data.duration === "number" && data.duration > 5 && Math.abs(data.duration - (this.currentShow.duration || 0)) > 2) {
            this.currentShow.duration = data.duration;
            if (this.currentShow.audio) this.currentShow.audio.duration = data.duration;
            this.renderTimeline();
          }

          // Prevent startup jitter: Allow 1.8s grace period while player buffers and stream starts.
          // Only snap after 1.8s and when backend has confirmed forward progress (data.current_time > 0.3s).
          if (elapsedSinceStart > 1800 && data.current_time > 0.3) {
            const diff = Math.abs(this.currentTime - data.current_time);
            if (diff > 0.45) {
              this.currentTime = data.current_time;
              this.playStartPos = data.current_time;
              this.playStartTime = performance.now();
              this.audioDelaySec = 0;
              this.updatePlayheadPosition();
              this.updateTimeDisplay();
            }
          }
        } else if (data && (data.state === "idle" || data.state === "stopped")) {
          // Avoid premature stop during initial play warmup
          if (elapsedSinceStart > 1500) {
            this.stop();
          }
        } else if (data && data.state === "paused" && this.isPlaying) {
          this.pause();
        }
      } catch (e) {}
    }, 350);
  }

  updatePlayheadPosition() {
    const x = this.currentTime * this.zoom;
    this.dom.playheadLine.style.transform = `translateX(${x}px)`;

    // Auto-scroll timeline container during playback to keep playhead in view
    const container = this.dom.timelineContainer;
    if (this.isPlaying && container) {
      const headerWidth = 220;
      const visibleWidth = container.clientWidth - headerWidth;
      const currentScroll = container.scrollLeft;
      if (x > currentScroll + visibleWidth - 80) {
        container.scrollLeft = x - visibleWidth + 180;
      } else if (x < currentScroll && currentScroll > 0) {
        container.scrollLeft = Math.max(0, x - 50);
      }
    }

    // Active playing glow on cues currently being played
    const visibleCues = document.querySelectorAll(".cue-block");
    visibleCues.forEach(el => {
      const time = parseFloat(el.dataset.time || 0);
      const duration = parseFloat(el.dataset.duration || 2.0);
      const isActive = this.currentTime >= time && this.currentTime <= (time + duration);
      el.classList.toggle("cue-active-playing", isActive);
    });

    this.updateHorizontalScrollbar();
  }

  updateHorizontalScrollbar() {
    const container = this.dom.timelineContainer;
    const track = this.dom.timelineScrollTrack;
    const thumb = this.dom.timelineScrollThumb;
    const label = this.dom.timelineScrollThumbLabel;
    if (!container || !track || !thumb) return;

    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    const maxScroll = Math.max(1, scrollWidth - clientWidth);

    if (scrollWidth <= clientWidth) {
      thumb.style.width = "100%";
      thumb.style.left = "0px";
      if (label) label.textContent = "100%";
      return;
    }

    const trackWidth = track.clientWidth || 300;
    const thumbWidth = Math.max(36, Math.min(trackWidth * 0.9, (clientWidth / scrollWidth) * trackWidth));
    const scrollRatio = Math.min(1, Math.max(0, container.scrollLeft / maxScroll));
    const thumbLeft = scrollRatio * (trackWidth - thumbWidth);

    thumb.style.width = `${thumbWidth}px`;
    thumb.style.left = `${thumbLeft}px`;

    if (label) {
      const curSec = (container.scrollLeft / this.zoom);
      const m = Math.floor(curSec / 60);
      const s = Math.floor(curSec % 60);
      label.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }

    if (this.dom.zoomDisplay) {
      this.dom.zoomDisplay.textContent = `${Math.round(this.zoom)} px/s`;
    }
  }

  fitSongToScreen() {
    const totalDuration = this.currentShow.duration || 240.0;
    const container = this.dom.timelineContainer;
    if (!container) return;

    // Timeline visible lane width (excluding track headers ~220px)
    const headerWidth = 220;
    const availableWidth = Math.max(400, container.clientWidth - headerWidth - 40);
    const idealZoom = Math.max(10, Math.min(250, availableWidth / (totalDuration + 2)));

    this.zoom = parseFloat(idealZoom.toFixed(1));
    if (this.dom.zoomSlider) this.dom.zoomSlider.value = this.zoom;
    if (this.dom.zoomDisplay) this.dom.zoomDisplay.textContent = `${Math.round(this.zoom)} px/s`;

    this.renderTimeline();
    container.scrollLeft = 0;
    this.updateHorizontalScrollbar();
    this.showToast(`↔️ Zoom angepasst: Ganzes Lied (${this.formatTime(totalDuration)}) im Blick`);
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
