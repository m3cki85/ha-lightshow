# ✦ LightShow Studio für Home Assistant

**LightShow Studio** ist eine moderne Home-Assistant-Integration mit integriertem Sequencer-Studio (Sidebar-Panel). Erstelle musiksynchrone Lichtshows mit visueller Audio-Waveform, arrangiere Lampen (Zigbee, Philips Hue, Shelly) sowie WLED-Streifen auf einer Takt-Timeline und spiele Audio über **Music Assistant** auf deinen Lautsprechern ab.

Shows werden im Python-Backend von Home Assistant ausgeführt und können somit **vollkommen autonom über normale Home-Assistant-Automationen** (z. B. Sprachbefehle, Bewegungsmelder, Taster, Zeitpläne) gestartet werden!

---

## ✨ Features

- 🎛 **Visueller Timeline-Sequencer:** Professioneller Multitrack-Editor direkt in der Home-Assistant-Seitenleiste.
- 🎵 **Audio-Waveform:** Echte Audio-Wellenform im Browser gerendert für taktgenaues Setzen von Keyframes (Cues).
- 🔊 **Music Assistant Integration:** Wähle deine Music Assistant Lautsprecher / Player direkt im Studio aus.
- 💡 **Intelligente Lampen-Erkennung:**
  - **WLED-Pixel-Strips:** Automatische Erkennung aller WLED-Effekte (Fire 2012, Rainbow, Chase, etc.) und Paletten.
  - **Zigbee- & WLAN-Lampen:** Automatische Begrenzung und Unterstützung von Fades/Transitions (z. B. 0.5s – 2.0s), um Zigbee-Mesh-Netzwerke zu schonen.
- 👁 **Live-Vorschau am echten Gerät:** Mit einem Klick auf *"Am Gerät testen"* siehst du sofort, wie Farbe, Helligkeit oder Effekt im Raum wirken.
- 🤖 **Voll automatisierbar:** Eigener Home-Assistant-Service `lightshow.play`, der direkt in Automationen und Dashboards verwendet werden kann.
- 🔒 **100% Lokal:** Keine Cloud nötig. Alle Shows werden als lesbare JSON-Dateien in `/config/lightshows/` gespeichert.

---

## 🚀 Installation

### Option 1: Über HACS (Empfohlen)

1. Öffne **HACS** in Home Assistant.
2. Klicke oben rechts auf die drei Punkte (`...`) ➔ **Benutzerdefinierte Repositories**.
3. Füge die Repository-URL ein:
   - **Kategorie:** `Integration`
4. Klicke auf **Hinzufügen** und installiere **LightShow Studio**.
5. Starte Home Assistant neu.
6. Gehe zu **Einstellungen** ➔ **Geräte & Dienste** ➔ **Integration hinzufügen** ➔ Suche nach **LightShow Studio** und bestätige.
7. In deiner Seitenleiste erscheint nun das Icon **LightShow**!

### Option 2: Manuelle Installation

1. Kopiere den Ordner `custom_components/lightshow` in deinen Home Assistant Konfigurationsordner:
   ```text
   /config/custom_components/lightshow/
   ```
2. Starte Home Assistant neu.
3. Gehe zu **Einstellungen** ➔ **Geräte & Dienste** ➔ **Integration hinzufügen** ➔ Suche nach **LightShow Studio**.

---

## 📖 Bedienung im Studio

1. **Audio bereitstellen:**
   - Wähle eine vorhandene Audiodatei aus oder klicke auf **Upload** (unterstützt MP3, WAV, FLAC, OGG).
   - Die Wellenform wird sofort im oberen Bereich gerendert.
2. **Lautsprecher wählen:**
   - Wähle deinen Music Assistant Lautsprecher aus der Dropdown-Liste.
3. **Lampen hinzufügen:**
   - Klicke auf `+ Lampe / WLED-Streifen hinzufügen`. Alle deine HA-Lichter stehen zur Verfügung.
4. **Cues (Keyframes) setzen:**
   - **Doppelklick** in die Timeline-Spur einer Lampe platziert einen neuen Cue.
   - Klicke auf den Cue, um den **Inspector** zu öffnen:
     - Helligkeit (0–100%)
     - Farbe (Farbwähler oder Palette)
     - Übergangszeit / Fade (in Sekunden)
     - WLED-Effekt (falls WLED-Strip)
   - Klicke auf `Am Gerät testen`, um das Licht sofort im Raum leuchten zu sehen!
5. **Vorschau & Test:**
   - **Studio (Browser):** Hör den Sound direkt am Computer/Tablet beim Arrangieren.
   - **Live (Lautsprecher):** Spielt den Sound über Music Assistant synchron auf der Musikanlage ab!
6. **Speichern:**
   - Klicke auf `💾 Speichern`.

---

## 🤖 In Automationen nutzen

Klicke im Studio oben rechts auf **📋 In Automation nutzen** oder verwende die Services direkt in YAML:

### Beispiel: Show per Automation starten
```yaml
alias: "Halloween Party Lichtshow"
trigger:
  - platform: state
    entity_id: input_boolean.party_mode
    to: "on"
action:
  - action: lightshow.play
    data:
      show_id: "demo_party_beat"
      player_entity_id: "media_player.living_room_speaker"
      loop: false
```

### Services Übersicht:
- `lightshow.play`: Startet eine Show (`show_id`, optional `player_entity_id`, optional `loop`).
- `lightshow.stop`: Stoppt die aktuelle Show sofort und fadet die Lampen sanft aus.
- `lightshow.pause`: Pausiert Show und Musik.
- `lightshow.resume`: Setzt eine pausierte Show fort.

---

## 📁 Dateisystem

Alle Daten liegen übersichtlich im Home Assistant Konfigurationsverzeichnis:
```text
/config/
└── lightshows/
    ├── demo_party_beat.json
    ├── halloween_show.json
    └── audio/
        ├── beat.mp3
        └── thriller.mp3
```
Dadurch können Shows ganz einfach gesichert oder zwischen verschiedenen Installationen ausgetauscht werden.
