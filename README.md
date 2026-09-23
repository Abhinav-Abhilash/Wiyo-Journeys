# Wiyo Journeys • വയ്യോ ജേർണീസ് 🚌
> **Kerala Multilingual Route & Fare Assistant**  
> *ANAVANDI FutureBuild 2026 • Problem Statement PS-02*  
> **Tagline:** *Your journey, made simple.*

[![Live on Vercel](https://img.shields.io/badge/Vercel-Live_App-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://wiyo-journeys.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)

---

## 🌟 Overview

**Wiyo Journeys** is an ultra-fast, 100% offline-capable Progressive Web Application (PWA) designed for Kerala public transit commuters. It provides seamless transit navigation, official Kerala Motor Vehicles Department (MVD) statutory stage fare calculations, spoken multilingual audio assistance, and real-time live journey progression with zero login barriers.

🌐 **Live Demo:** [https://wiyo-journeys.vercel.app](https://wiyo-journeys.vercel.app)

---

## ✨ Key Features

### 1. 🌐 4-Language Multilingual Support (Strict Language Isolation)
* Full support across **English**, **Malayalam (`മലയാളം`)**, **Tamil (`தமிழ்`)**, and **Hindi (`हिंदी`)**.
* Every screen strictly adheres to the selected language without mixed-language leakage.

### 2. 📴 100% Offline Core Architecture
* **Deterministic Stage Fare Calculation:** Computes exact Kerala MVD statutory stage tariffs (Ordinary, Fast Passenger, Super Fast) on-device without cloud API dependencies.
* **Offline Route Graph Engine:** Search stops, routes, and connections instantly in <2 ms from local in-memory datasets.
* **Pre-cached Phrase Audio:** Studio-grade audio announcements available even when internet connectivity drops to zero.

### 3. 🎙️ Multilingual Voice & Speech Assistant
* **Speech-to-Text (STT):** Spoken destination searches with phonetic transliteration for South Indian place names.
* **Text-to-Speech (TTS):** Dynamic voice synthesis announcing route numbers, boarding stops, alighting landmarks, and estimated fares.

### 4. 🧭 Nearest Reachable Stop Fallback (Geometric Routing)
* If no direct bus exists between the passenger's boarding stop and requested destination, the engine calculates the **closest reachable stop** using offline Haversine distance.
* Displays a clear fallback banner with remaining walking/auto transfer distance (in km) and 8-point localized compass bearing (*e.g., "Alight at Palarivattom; destination is 6.2 km East"*).

### 5. 🗺️ Live Simulated GPS Journey Tracking & Alighting Alerts
* Real-time vehicle simulation along actual Kerala highway and urban road corridors.
* Next-stop announcements, progression bar, distance countdown, and audio alerts triggered within 150m of the target stop.
* Interactive Leaflet map with dark/light mode tile compatibility and schematic linear progress nodes.

### 6. 🎨 Premium UI & Responsive Viewports
* Authentic Kerala rainforest & KSRTC aesthetic with smooth dark/light mode toggle.
* Seamless switching between **Mobile Phone Frame** and **Laptop / Desktop Wide View**.

---

## 🛠️ Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Strict type safety, deterministic routing logic, zero runtime type errors. |
| **Bundler & Server** | [Vite](https://vitejs.dev/) | Instant HMR, ultra-lightweight production bundle (<115 KB). |
| **Styling & Theme** | [Tailwind CSS](https://tailwindcss.com/) | High-contrast accessible transit colors, dark mode tokens, fluid animations. |
| **Maps & GIS** | [Leaflet.js](https://leafletjs.com/) + OpenStreetMap | Lightweight open-source mapping with vector overlays and offline tile fallback. |
| **Speech Engine** | [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) | Low-latency on-device speech recognition & voice synthesis. |
| **Storage & Data** | In-Memory JSON + LocalStorage | Instantaneous zero-latency querying, 100% offline capability. |
| **Deployment** | [Vercel](https://vercel.com/) | Continuous deployment with global CDN edge caching. |

---

## 📊 Datasets Used

1. **Kerala Bus Network & Multilingual Stops (`src/data/kerala_routes_stops.json`):**
   * Major transit stops (Ernakulam, Thrissur, Trivandrum, Kozhikode) with 4-language names, GPS coordinates, local landmark cues, and phonetic search aliases.
2. **KSRTC Routes & Official Stages (`src/data/kerala_routes_stops.json`):**
   * Route numbers (12A, 14, 21, FP-101, SF-202), service classes, stage numbers, first/last bus timings, and service frequencies.
3. **Kerala MVD Statutory Fare Tariff Rules (`src/core/fare_calculator.ts`):**
   * Government gazette stage fare formulas for Ordinary, Fast Passenger, and Super Fast buses including statutory cess.
4. **GIS Road Geometries (`src/data/road_geometries.ts`):**
   * Dense GPS polyline coordinates along Kerala road corridors for realistic vehicle tracking.
5. **Pre-cached Audio Phrase Bank (`src/data/cached_audio_phrases.json`):**
   * Multilingual voice waveforms for offline audio fallback.

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [npm](https://www.npmjs.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Abhinav-Abhilash/Wiyo-Journeys.git
   cd Wiyo-Journeys
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. **Build for production:**
   ```bash
   npm run build
   ```
   The production-ready assets will be generated in the `dist/` directory.

---

## 📁 Project Structure

```
Wiyo-Journeys/
├── public/                     # Static assets, logos, and cached audio files
│   ├── images/
│   │   └── wiyo-logo.png       # Official Wiyo Journeys branding logo
│   └── cached_audio_phrases.json
├── src/
│   ├── core/                   # Deterministic Core Engines
│   │   ├── fare_calculator.ts  # Official Kerala MVD Stage Fare Calculator
│   │   ├── geo.ts              # Haversine distance, GPS & compass bearing calculations
│   │   ├── routing.ts          # Graph router, direct paths & nearest-stop fallback
│   │   ├── search.ts           # Indic multilingual phonetic fuzzy search
│   │   ├── tracking_engine.ts  # Live GPS simulation & stop proximity alert engine
│   │   └── voice_manager.ts    # Web Speech API & pre-cached audio coordinator
│   ├── data/                   # Datasets
│   │   ├── kerala_routes_stops.json # Stops, routes, stages & timetables
│   │   └── road_geometries.ts  # Highway & road polyline GPS coordinates
│   ├── app.ts                  # Main application controller, i18n & UI event wiring
│   └── types.ts                # TypeScript interfaces & domain models
├── index.html                  # Main SPA markup & 4-screen viewports
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 👥 Authors & Acknowledgements
* Developed for **ANAVANDI FutureBuild 2026** (Hackathon Problem Statement PS-02).
* Built with ❤️ for Kerala bus commuters.
