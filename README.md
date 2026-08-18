# Chicago Transit Dashboard

A real-time CTA train tracking dashboard that visualizes Chicago's rail system, active trains, station arrival predictions, and local weather in a single interface.

**Live Demo:** [https://chicago-transit-dashboard.pages.dev](https://chicago-transit-dashboard.pages.dev)

The project combines live CTA Train Tracker data with static CTA route and station data to create an interactive view of the Chicago "L" system.

---

## Features

- Live train positions across all eight CTA rail lines
- Automatic train data refresh every 15 seconds
- Interactive CTA system map with stations and route geometry
- Individual line filtering for Red, Blue, Brown, Green, Orange, Pink, Purple, and Yellow Lines
- Live station arrival predictions
- Train tooltips showing destination, run number, next station, ETA, and service status
- System overview with active train counts and reported delays
- Chicago weather conditions and precipitation probability
- Simplified Chicago geographic background with Lake Michigan
- Responsive layout for smaller screens

---

## How It Works

The dashboard combines static transit data with live CTA Train Tracker information.

Static station locations and route geometry are used to construct the transit map. Live train positions are then projected onto the same coordinate system so trains can be displayed alongside their corresponding routes and stations.

Some parts of the CTA system share the same physical tracks. To keep these sections readable, the dashboard uses shared route geometry with small visual offsets for the Red, Brown, and Purple Lines. The downtown Loop is also rendered using a single shared track rather than stacking several overlapping route shapes.

Live train and station arrival requests are routed through server-side Cloudflare Functions so the CTA API key is not exposed to the browser.

---

## Technologies

- HTML
- CSS
- JavaScript
- SVG
- Cloudflare Pages
- Cloudflare Functions
- CTA Train Tracker API
- CTA GTFS data
- Open-Meteo API

---

## Data Sources

### Chicago Transit Authority

Live train positions and station arrival predictions are provided through the CTA Train Tracker API.

Static station coordinates and route geometry are derived from CTA transit data and used to construct the system map.

### Open-Meteo

Current Chicago weather conditions and precipitation probability are retrieved from Open-Meteo.

Weather requests use Chicago coordinates and are displayed alongside the transit information.

---

## Running Locally

Because live CTA requests are handled through Cloudflare Functions, the project should be run using Wrangler rather than opening `index.html` directly.

### 1. Clone the repository

```bash
git clone https://github.com/haniksator/chicago-transit-dashboard.git
cd chicago-transit-dashboard
```

### 2. Install Wrangler

```bash
npm install -D wrangler
```

### 3. Configure the CTA API Key

Create a `.dev.vars` file in the project root:

```text
CTA_API_KEY=your_api_key_here
```

The CTA API key is used only by the server-side Cloudflare Functions and should never be committed to the repository.

Make sure `.dev.vars` is included in `.gitignore`.

### 4. Start the Development Server

```bash
npx wrangler pages dev .
```

Open the local address provided by Wrangler in your browser.

---

## Project Structure

```text
chicago-transit-dashboard/
├── data/
│   └── ...
├── functions/
│   └── api/
│       ├── arrivals.js
│       └── trains.js
├── js/
│   ├── app.js
│   ├── cta-api.js
│   ├── transit-map.js
│   └── weather.js
├── index.html
├── styles.css
└── README.md
```

The project is separated into a few main pieces:

- `app.js` coordinates the dashboard, filtering, station details, and automatic data refreshes.
- `cta-api.js` retrieves and normalizes live CTA train and arrival data.
- `transit-map.js` handles geographic projection, route geometry, stations, shared-track rendering, train markers, and the map background.
- `weather.js` retrieves and normalizes current Chicago weather information.
- `functions/api/` contains the server-side CTA API proxies used to keep the CTA API key private.

---

## Project Purpose

I built this project to work with real-world transit data while getting more experience with APIs, asynchronous JavaScript, geographic data, and interactive data visualization.

One of the more interesting parts of the project was handling sections of the CTA system where multiple lines share the same physical tracks. Instead of simply drawing every route on top of each other, the map reconstructs several shared corridors to keep the different services visible while still following the underlying route geometry.

The project also gave me experience deploying a frontend with server-side API functions through Cloudflare Pages and keeping API credentials outside of the client.

---

## Data Accuracy

Train positions and arrival predictions depend on the information returned by the CTA Train Tracker API and should be treated as estimates rather than exact real-time GPS positions.

The transit map is a custom visualization of the CTA rail system and is not intended to replace an official CTA map or navigation service.

---

## Links

- [Live Demo](https://chicago-transit-dashboard.pages.dev)
- [Source Code](https://github.com/haniksator/chicago-transit-dashboard)