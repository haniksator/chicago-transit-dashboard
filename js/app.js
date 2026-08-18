import { getTrains, getStationArrivals} from "./cta.js";
import {getSharedBounds, renderChicagoBackground, renderRoutes, renderStations, renderLineTrains} from "./transit-map.js";
import { getWeather } from "./weather.js";

/* ================
   DOM REFERENCES
   ================ */
const trainCount = document.getElementById("train-count");
const trainList = document.getElementById("train-list");
const stationDetails = document.getElementById("station-details");
const lastUpdated = document.getElementById("last-updated");
const weatherCurrent = document.getElementById("weather-current");
const systemOverview = document.getElementById("system-overview");
const lineFilterButtons =document.querySelectorAll(".line-filter-btn");
const mapTitle = document.getElementById("map-title");

/* ==================
   APPLICATION STATE
   ================== */
let loadedLines = [];
let mapBounds = null;
let selectedStation = null;
let selectedLineFilter = "all";

/* ========================
   CTA LINE CONFIGURATION
   ======================== */
const lines = [
    {
        id: "red",
        name: "Red Line",
        color: "#c60c30",
        stationsUrl: "./data/lines/red-stations.json",
        shapeUrl: "./data/lines/red-shape.json"
    },
    {
        id: "blue",
        name: "Blue Line",
        color: "#00a1de",
        stationsUrl: "./data/lines/blue-stations.json",
        shapeUrl: "./data/lines/blue-shape.json"
    },
    {
        id: "brn",
        name: "Brown Line",
        color: "#62361b",
        stationsUrl: "./data/lines/brown-line-stations.json",
        shapeUrl: "./data/lines/brown-line-shape.json"
    },
    {
        id: "g",
        name: "Green Line",
        color: "#009b3a",
        stationsUrl: "./data/lines/green-stations.json",
        shapeUrl: "./data/lines/green-shape.json"
    },
    {
        id: "org",
        name: "Orange Line",
        color: "#f9461c",
        stationsUrl: "./data/lines/orange-stations.json",
        shapeUrl: "./data/lines/orange-shape.json"
    },
    {
        id: "pink",
        name: "Pink Line",
        color: "#e27ea6",
        stationsUrl: "./data/lines/pink-stations.json",
        shapeUrl: "./data/lines/pink-shape.json"
    },
    {
        id: "p",
        name: "Purple Line",
        color: "#522398",
        stationsUrl: "./data/lines/purple-line-stations.json",
        shapeUrl: "./data/lines/purple-line-shape.json"
    },
    {
        id: "y",
        name: "Yellow Line",
        color: "#f9e300",
        stationsUrl: "./data/lines/yellow-line-stations.json",
        shapeUrl: "./data/lines/yellow-line-shape.json"
    }
];

/*
 * Loads and parses a JSON file.
 *
 * Used for the static station and route-shape
 * data stored within the project.
 */
async function loadJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to load ${url}`);
    }

    return response.json();
}

/*
 * Loads the static station and route geometry
 * for a single CTA line.
 *
 * Live train data is intentionally excluded here
 * because it is refreshed separately.
 */
async function loadLineData(line) {
    const [stations, shapePoints] =
        await Promise.all([
            loadJson(line.stationsUrl),
            loadJson(line.shapeUrl)
        ]);

    return {
        ...line,
        stations,
        shapePoints,
        trains: []
    };
}

/*
 * Weather Section
 */

/*
 * Retrieves current Chicago weather data and
 * renders it in the dashboard weather card.
 */
async function loadWeather() {
    try {
        const weather =
            await getWeather();

        renderWeather(weather);

    } catch (error) {
        console.error(
            "Unable to load weather:",
            error
        );

        weatherCurrent.innerHTML = `
            <div class="weather-error">
                Unable to load weather.
            </div>
        `;
    }
}

/*
 * Renders normalized Open-Meteo weather data
 * inside the Chicago Weather dashboard card.
 */
function renderWeather(weather) {
    const description =
        getWeatherDescription(
            weather.weather_code
        );

    weatherCurrent.innerHTML = `
        <div class="weather-main">

            <div class="weather-temperature">
                ${Math.round(
                    weather.temperature_2m
                )}°
            </div>

            <div>
                <div class="weather-condition">
                    ${description}
                </div>

                <div class="weather-feels">
                    Feels like
                    ${Math.round(
                        weather.apparent_temperature
                    )}°
                </div>
            </div>

        </div>

        <div class="weather-details">

            <div class="weather-detail">
                <span>Rain chance</span>

                <strong>
                    ${
                        weather.precipitationProbability !== null
                            ? `${weather.precipitationProbability}%`
                            : "Unavailable"
                    }
                </strong>
            </div>

            <div class="weather-detail">
                <span>Wind</span>
                <strong>
                    ${Math.round(
                        weather.wind_speed_10m
                    )} mph
                </strong>
            </div>

        </div>
    `;
}

/*
 * Converts Open-Meteo WMO weather codes into
 * readable condition descriptions.
 */
function getWeatherDescription(code) {
    const descriptions = {
        0: "Clear",
        1: "Mostly clear",
        2: "Partly cloudy",
        3: "Overcast",

        45: "Fog",
        48: "Freezing fog",

        51: "Light drizzle",
        53: "Drizzle",
        55: "Heavy drizzle",

        56: "Light freezing drizzle",
        57: "Freezing drizzle",

        61: "Light rain",
        63: "Rain",
        65: "Heavy rain",

        66: "Light freezing rain",
        67: "Freezing rain",

        71: "Light snow",
        73: "Snow",
        75: "Heavy snow",

        77: "Snow grains",

        80: "Light showers",
        81: "Showers",
        82: "Heavy showers",

        85: "Light snow showers",
        86: "Heavy snow showers",

        95: "Thunderstorms",
        96: "Thunderstorms with hail",
        99: "Severe thunderstorms with hail"
    };

    return descriptions[code]
        ?? "Unknown conditions";
}

/*
 * Train Data & Refresh Section
 */

/*
 * Retrieves fresh train positions for every CTA line.
 *
 * Updates the stored train data, active train count,
 * visible train markers, System Overview, and the
 * dashboard's last-updated timestamp.
 */
async function refreshTrains() {
    try {
        const trainResults =
            await Promise.all(
                loadedLines.map(line =>
                    getTrains(line.id)
                )
            );

        loadedLines.forEach(
            (line, index) => {
                line.trains =
                    trainResults[index];
            }
        );

        const totalTrains =
            loadedLines.reduce(
                (sum, line) =>
                    sum +
                    line.trains.length,
                0
            );

        trainCount.textContent =
            `${totalTrains} trains currently active`;

        renderCurrentTrains();

        renderSystemOverview();

        updateLastUpdated();

    } catch (error) {
        console.error(
            "Unable to refresh trains:",
            error
        );
    }
}

/*
 * Replaces the current live train markers without
 * redrawing routes or stations.
 *
 * Respects the active CTA line filter.
 */
function renderCurrentTrains() {
    /*
     * Remove only the existing train markers.
     */
    trainList
        .querySelectorAll(".train-marker")
        .forEach(marker => {
            marker.remove();
        });

    /*
     * Respect the currently selected line filter.
     */
    const visibleLines =
        selectedLineFilter === "all"
            ? loadedLines
            : loadedLines.filter(
                line =>
                    line.id === selectedLineFilter
            );

    visibleLines.forEach(line => {
        renderLineTrains(
            trainList,
            line,
            mapBounds
        );
    });
}

/*
 * Updates the dashboard timestamp after fresh
 * train data has been successfully rendered.
 */
function updateLastUpdated() {
    const now =
        new Date();

    lastUpdated.textContent =
        `Updated ${now.toLocaleTimeString(
            [],
            {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit"
            }
        )}`;
}

/*
 * System Overview Section
 */

/*
 * Renders system-wide CTA activity in the sidebar.
 *
 * Displays total active trains, per-line train counts,
 * delayed train information, and clickable line rows
 * that can also control the map filter.
 */
function renderSystemOverview() {
    if (!systemOverview) {
        return;
    }

    const totalTrains =
        loadedLines.reduce(
            (sum, line) =>
                sum + line.trains.length,
            0
        );

    const delayedTrains =
        loadedLines.reduce(
            (sum, line) =>
                sum +
                line.trains.filter(
                    train => train.delayed
                ).length,
            0
        );

    const normalTrains =
        totalTrains - delayedTrains;

    const lineRows =
        loadedLines
            .map(line => {
                return `
                    <div
                        class="
                            system-line-row
                            ${
                                selectedLineFilter === line.id
                                    ? "active"
                                    : ""
                            }
                        "
                        data-line="${line.id}"
                    >

                        <div class="system-line-name">
                            <span
                                class="system-line-dot"
                                style="
                                    background:
                                        ${line.color};
                                "
                            ></span>

                            <span>
                                ${line.name}
                            </span>
                        </div>

                        <strong>
                            ${line.trains.length}
                        </strong>

                    </div>
                `;
            })
            .join("");

    systemOverview.innerHTML = `
        <div class="system-total">
            <span class="system-total-number">
                ${totalTrains}
            </span>

            <span class="system-total-label">
                trains active
            </span>
        </div>

        <div class="system-lines">
            ${lineRows}
        </div>

        <div class="system-status">
            <div>
                <span class="status-indicator normal"></span>

                ${normalTrains}
                running normally
            </div>

            ${
                delayedTrains > 0
                    ? `
                        <div>
                            <span class="status-indicator delayed"></span>

                            ${delayedTrains}
                            ${
                                delayedTrains === 1
                                    ? "train"
                                    : "trains"
                            }
                            reporting delays
                        </div>
                    `
                    : ""
            }
        </div>
    `;
    systemOverview
        .querySelectorAll(".system-line-row")
        .forEach(row => {
            row.addEventListener(
                "click",
                () => {
                    selectLineFilter(
                        row.dataset.line
                    );
                }
            );
        });
}

/*
 * Map Filtering Section
 */

/*
 * Redraws the map using the currently selected CTA line.
 *
 * Full-system geographic bounds are intentionally
 * preserved so filtering a line does not zoom or move
 * the map.
 */
function renderFilteredMap() {
    if (
        loadedLines.length === 0 ||
        !mapBounds
    ) {
        return;
    }

    trainList.innerHTML = "";

    const visibleLines =
        selectedLineFilter === "all"
            ? loadedLines
            : loadedLines.filter(
                line =>
                    line.id === selectedLineFilter
            );

    /*
     * Keep the original full-system bounds
     * so the map doesn't jump around when
     * switching lines.
     */

    renderChicagoBackground(
        trainList,
        mapBounds
    );

    renderRoutes(
        trainList,
        visibleLines,
        mapBounds
    );

    renderStations(
        trainList,
        visibleLines,
        mapBounds,
        showStationDetails
    );

    visibleLines.forEach(line => {
        renderLineTrains(
            trainList,
            line,
            mapBounds
        );
    });
}

/*
 * Changes the active CTA line filter.
 *
 * Synchronizes the toolbar buttons, map title,
 * transit map, and System Overview selection.
 */
function selectLineFilter(lineId) {
    selectedLineFilter = lineId;

    /*
     * Update toolbar buttons.
     */
    lineFilterButtons.forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.line === lineId
        );
    });


    /*
     * Update map title.
     */
    if (lineId === "all") {
        mapTitle.textContent =
            "All CTA Lines";
    } else {
        const selectedLine =
            loadedLines.find(
                line =>
                    line.id === lineId
            );

        mapTitle.textContent =
            selectedLine
                ? selectedLine.name
                : "CTA Lines";
    }


    /*
     * Redraw map and overview.
     */
    renderFilteredMap();
    renderSystemOverview();
}

/*
 * Station Details Section
 */

/*
 * Selects a station and populates the Station Details
 * card with its name, served lines, and live arrivals.
 */
async function showStationDetails(station) {
    selectedStation = station;

    const displayName =
        getDisplayStationName(
            station.name
        );

    const lineBadges =
        station.lines
            .map(line => {
                return `
                    <span
                        class="station-line-badge"
                        style="
                            --line-color:
                                ${line.color};
                        "
                    >
                        ${line.name}
                    </span>
                `;
            })
            .join("");

    stationDetails.innerHTML = `
        <div class="selected-station-name">
            ${displayName}
        </div>

        <div class="selected-station-lines">
            ${lineBadges}
        </div>

        <div class="station-arrivals">
            Loading arrivals...
        </div>
    `;

    try {
        const arrivals =
            await getStationArrivals(
                station.id
            );

        renderStationArrivals(arrivals, displayName);

    } catch (error) {
        console.error(error);

        const arrivalsElement =
            stationDetails.querySelector(
                ".station-arrivals"
            );

        arrivalsElement.innerHTML = `
            <div class="arrival-error">
                Unable to load arrivals.
            </div>
        `;
    }
}

/*
 * Refreshes live arrival predictions for the currently
 * selected station without rebuilding the entire
 * Station Details card.
 */
async function refreshSelectedStation() {
    if (!selectedStation) {
        return;
    }

    try {
        const arrivals =
            await getStationArrivals(
                selectedStation.id
            );

        const displayName =
            getDisplayStationName(
                selectedStation.name
            );

        renderStationArrivals(
            arrivals,
            displayName
        );

    } catch (error) {
        console.error(
            "Unable to refresh station arrivals:",
            error
        );
    }
}

/*
 * Renders CTA arrival predictions for a selected station.
 *
 * Arrivals are grouped by line, sorted by ETA, and given
 * rider-friendly labels for approaching, due, delayed,
 * and terminal-departure conditions.
 */
function renderStationArrivals(arrivals, selectedStationName) {
    const arrivalsElement =
        stationDetails.querySelector(
            ".station-arrivals"
        );

    if (!arrivalsElement) {
        return;
    }

    if (arrivals.length === 0) {
        arrivalsElement.innerHTML = `
            <div class="arrival-empty">
                No upcoming trains found.
            </div>
        `;

        return;
    }

    /*
     * Group arrivals by CTA route ID.
     */
    const groupedArrivals = {};

    arrivals.forEach(arrival => {
        if (!groupedArrivals[arrival.route]) {
            groupedArrivals[arrival.route] = [];
        }

        groupedArrivals[arrival.route].push(
            arrival
        );
    });


    /*
     * Keep CTA lines in a predictable order.
     */
    const routeOrder = [
        "Red",
        "Blue",
        "Brn",
        "G",
        "Org",
        "Pink",
        "P",
        "Y"
    ];


    const groups = Object.entries(
        groupedArrivals
    ).sort(
        ([routeA], [routeB]) =>
            routeOrder.indexOf(routeA) -
            routeOrder.indexOf(routeB)
    );


    arrivalsElement.innerHTML =
        groups
            .map(([route, routeArrivals]) => {

                /*
                 * Sort trains on this line
                 * by soonest arrival.
                 */
                routeArrivals.sort(
                    (a, b) =>
                        a.minutes - b.minutes
                );

                const rows =
                    routeArrivals
                        .slice(0, 4)
                        .map(arrival => {
                            let etaText;

                            const isDepartingTerminalTrain =
                                isTerminalStation(selectedStationName) &&
                                arrival.destination !== selectedStationName &&
                                arrival.approaching;

                            if (isDepartingTerminalTrain) {
                                etaText =
                                    "Departing soon";
                            } else if (arrival.approaching) {
                                etaText =
                                    "Approaching";
                            } else if (
                                arrival.minutes <= 1
                            ) {
                                etaText =
                                    "Due";
                            } else {
                                etaText =
                                    `${arrival.minutes} min`;
                            }

                            const destinationText =
                                arrival.destination === selectedStationName
                                    ? `Arriving at ${selectedStationName}`
                                    : `Toward ${arrival.destination}`;

                            return `
                                <div class="arrival-row">

                                    <div class="arrival-destination">
                                        ${destinationText}
                                        <span class="arrival-run">
                                            Train ${arrival.runNumber}
                                        </span>
                                    </div>

                                    <div
                                        class="
                                            arrival-eta
                                            ${
                                                arrival.delayed
                                                    ? "delayed"
                                                    : ""
                                            }
                                        "
                                    >
                                        ${etaText}
                                    </div>

                                </div>
                            `;
                        })
                        .join("");

                return `
                    <div class="arrival-group">

                        <div class="arrival-group-title">
                            ${getRouteDisplayName(route)}
                        </div>

                        ${rows}

                    </div>
                `;
            })
            .join("");
}

/*
 * Removes route suffixes such as "(Red)" or "(Blue)"
 * from station names before displaying them in the UI.
 */
function getDisplayStationName(name) {
    return name
        .replace(/\s*\([^)]*\)\s*$/, "")
        .trim();
}

/*
 * Converts CTA route IDs into user-facing line names.
 */
function getRouteDisplayName(routeId) {
    const routeNames = {
        Red: "Red Line",
        Blue: "Blue Line",
        Brn: "Brown Line",
        G: "Green Line",
        Org: "Orange Line",
        Pink: "Pink Line",
        P: "Purple Line",
        Y: "Yellow Line"
    };

    return routeNames[routeId] || routeId;
}

/*
 * Returns whether a station is treated as a CTA
 * terminal for arrival-status presentation.
 */
function isTerminalStation(stationName) {
    const terminals = new Set([
        "O'Hare",
        "Forest Park",
        "95th/Dan Ryan",
        "Howard",
        "Kimball",
        "Linden",
        "Harlem/Lake",
        "Ashland/63rd",
        "Cottage Grove",
        "Midway",
        "54th/Cermak",
        "Dempster-Skokie"
    ]);

    return terminals.has(stationName);
}

/*
 * Dashboard Initialization Section
 */

/*
 * Initializes the transit dashboard.
 *
 * Loads static CTA line data, calculates shared
 * geographic bounds, renders the map background,
 * routes, and stations, then performs the first
 * live train refresh.
 *
 * Static map elements are rendered only once.
 */
async function loadDashboard() {
    try {
        /*
         * Load static station + route data once.
         */
        loadedLines =
            await Promise.all(
                lines.map(loadLineData)
            );

        mapBounds =
            getSharedBounds(
                loadedLines
            );

        renderChicagoBackground(
            trainList,
            mapBounds
        );

        /*
         * Draw static route geometry once.
         */
        renderRoutes(
            trainList,
            loadedLines,
            mapBounds
        );

        /*
         * Draw static stations once.
         */
        renderStations(
            trainList,
            loadedLines,
            mapBounds,
            showStationDetails
        );

        /*
         * Fetch and draw live trains.
         */
        await refreshTrains();

    } catch (error) {
        console.error(error);

        trainCount.textContent =
            "Unable to load CTA train data.";
    }
}

/*
 * Event Listeners Section
 */

lineFilterButtons.forEach(button => {
    button.addEventListener(
        "click",
        () => {
            selectLineFilter(
                button.dataset.line
            );
        }
    );
});

/*
 * Start Up Section.
 */

loadDashboard();
loadWeather();

/*
 * Refresh live train positions and the currently
 * selected station's arrivals every 15 seconds.
 */
const REFRESH_INTERVAL =
    15 * 1000;

setInterval(
    async () => {
        if (loadedLines.length === 0) {
            return;
        }

        await Promise.all([
            refreshTrains(),
            refreshSelectedStation()
        ]);
    },
    REFRESH_INTERVAL
);


/*
 * Weather changes less frequently, so refresh it
 * independently every 15 minutes.
 */
const WEATHER_REFRESH_INTERVAL =
    15 * 60 * 1000;

setInterval(
    loadWeather,
    WEATHER_REFRESH_INTERVAL
);