import { getTrains, getStationArrivals} from "./cta.js";
import {getSharedBounds, renderRoutes, renderStations, renderLineTrains} from "./transit-map.js";

const trainCount = document.getElementById("train-count");
const trainList = document.getElementById("train-list");
const stationDetails = document.getElementById("station-details");
const lastUpdated = document.getElementById("last-updated");

let loadedLines = [];
let mapBounds = null;
let selectedStation = null;

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

async function loadJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to load ${url}`);
    }

    return response.json();
}

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

loadDashboard();

const REFRESH_INTERVAL = 15000;

setInterval(async () => {
    if (loadedLines.length === 0) {
        return;
    }

    await Promise.all([
        refreshTrains(),
        refreshSelectedStation()
    ]);
}, REFRESH_INTERVAL);

function renderCurrentTrains() {
    /*
     * Remove only the existing train markers.
     *
     * Routes and stations stay untouched.
     */
    trainList
        .querySelectorAll(".train-marker")
        .forEach(marker => {
            marker.remove();
        });

    loadedLines.forEach(line => {
        renderLineTrains(
            trainList,
            line,
            mapBounds
        );
    });
}

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

        updateLastUpdated();

    } catch (error) {
        console.error(
            "Unable to refresh trains:",
            error
        );
    }
}

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

function getDisplayStationName(name) {
    return name
        .replace(/\s*\([^)]*\)\s*$/, "")
        .trim();
}

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