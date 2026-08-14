import { getTrains } from "./cta.js";

const trainCount = document.getElementById("train-count");
const trainList = document.getElementById("train-list");

async function getRedLineStations() {
    const response = await fetch("./data/red-line-stations.json");

    if (!response.ok) {
        throw new Error("Failed to load Red Line station data");
    }

    return response.json();
}

async function getRedLineShape() {
    const response = await fetch("./data/red-line-shape.json");

    if (!response.ok) {
        throw new Error("Failed to load Red Line shape data");
    }

    return response.json();
}

/*
 * Builds geographic bounds around all Red Line stations.
 */
function getBounds(stations) {
    const lats = stations.map(station => station.lat);
    const lons = stations.map(station => station.lon);

    return {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLon: Math.min(...lons),
        maxLon: Math.max(...lons)
    };
}


/*
 * Converts latitude/longitude into pixel coordinates
 * inside the Red Line map.
 *
 * We use the same scale for X and Y so the overall
 * geography stays reasonably proportional.
 */
function projectPoint(lat, lon, bounds) {
    const width = trainList.clientWidth;
    const height = trainList.clientHeight;

    const padding = 80;

    const averageLat =
        (bounds.minLat + bounds.maxLat) / 2;

    /*
     * Longitude degrees get physically smaller as
     * latitude increases.
     */
    const lonCorrection =
        Math.cos(averageLat * Math.PI / 180);

    const xRange =
        (bounds.maxLon - bounds.minLon) *
        lonCorrection;

    const yRange =
        bounds.maxLat - bounds.minLat;

    const usableWidth =
        width - padding * 2;

    const usableHeight =
        height - padding * 2;

    const scale = Math.min(
        usableWidth / xRange,
        usableHeight / yRange
    );

    const geographicWidth =
        xRange * scale;

    /*
     * Center the narrow Red Line horizontally.
     */
    const horizontalOffset =
        (width - geographicWidth) / 2;

    const x =
        horizontalOffset +
        (lon - bounds.minLon) *
        lonCorrection *
        scale;

    const y =
        padding +
        (bounds.maxLat - lat) *
        scale;

    return { x, y };
}


/*
 * Draw the actual line connecting every CTA station.
 */
function drawRoute(shapePoints, bounds) {
    const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
    );

    svg.classList.add("route-svg");

    const polyline = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline"
    );

    const points = shapePoints
        .map(point => {
            const projected = projectPoint(
                point.lat,
                point.lon,
                bounds
            );

            return `${projected.x},${projected.y}`;
        })
        .join(" ");

    polyline.setAttribute("points", points);
    polyline.classList.add("route-line");

    svg.appendChild(polyline);

    trainList.appendChild(svg);
}


/*
 * Draw every CTA station.
 */
function renderStations(stations, bounds) {
    stations.forEach(station => {
        const point = projectPoint(
            station.lat,
            station.lon,
            bounds
        );

        const stationElement =
            document.createElement("div");

        stationElement.classList.add("map-station");

        stationElement.style.left = `${point.x}px`;
        stationElement.style.top = `${point.y}px`;

        stationElement.innerHTML = `
            <div class="station-dot"></div>

            <div class="station-name">
                ${station.name}
            </div>
        `;

        trainList.appendChild(stationElement);
    });
}


/*
 * Creates the compact marker + hover information.
 */
function createTrainMarker(train) {
    const marker = document.createElement("div");

    marker.classList.add(
        "train-marker",
        train.direction
    );

    marker.innerHTML = `
        <div class="train-compact">
            <span class="train-arrow">
                ${
                    train.direction === "northbound"
                        ? "↑"
                        : "↓"
                }
            </span>

            <span class="train-number">
                ${train.runNumber}
            </span>
        </div>

        <div class="train-tooltip">
            <div class="tooltip-title">
                Train ${train.runNumber}
            </div>

            <div>To: ${train.destination}</div>
            <div>Next: ${train.nextStation}</div>

            ${
                train.approaching
                    ? `
                        <div class="tooltip-status approaching">
                            Approaching
                        </div>
                    `
                    : ""
            }

            ${
                train.delayed
                    ? `
                        <div class="tooltip-status delayed">
                            Delayed
                        </div>
                    `
                    : ""
            }
        </div>
    `;

    return marker;
}


/*
 * Trains now use their ACTUAL live CTA coordinates.
 */
function renderTrains(trains, bounds) {
    trains.forEach(train => {
        if (
            !Number.isFinite(train.latitude) ||
            !Number.isFinite(train.longitude)
        ) {
            return;
        }

        const point = projectPoint(
            train.latitude,
            train.longitude,
            bounds
        );

        const marker =
            createTrainMarker(train);

        marker.style.left = `${point.x}px`;
        marker.style.top = `${point.y}px`;

        trainList.appendChild(marker);
    });
}


function renderMap(stations, shapePoints, trains) {
    trainList.innerHTML = "";

    const bounds = getBounds(stations);

    drawRoute(shapePoints, bounds);
    renderStations(stations, bounds);
    renderTrains(trains, bounds);
}


async function loadTrains() {
    try {
        const [stations, shapePoints, trains] =
            await Promise.all([
                getRedLineStations(),
                getRedLineShape(),
                getTrains("red")
            ]);

        trainCount.textContent =
            `${trains.length} trains currently active`;

        renderMap(stations, shapePoints, trains);

    } catch (error) {
        console.error(error);

        trainCount.textContent =
            "Unable to load CTA train data.";
    }
}

loadTrains();