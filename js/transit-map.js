export function getSharedBounds(lines) {
    const stations = lines.flatMap(
        line => line.stations
    );

    const lats = stations.map(
        station => station.lat
    );

    const lons = stations.map(
        station => station.lon
    );

    return {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLon: Math.min(...lons),
        maxLon: Math.max(...lons)
    };
}

function projectPoint(lat, lon, bounds, container) {
    const width = container.clientWidth;
    const height = container.clientHeight;

    const padding = 80;

    const averageLat =
        (bounds.minLat + bounds.maxLat) / 2;

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

function drawRoute(container, shapeData, bounds, color) {
    const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
    );

    svg.classList.add("route-svg");

    const paths = Array.isArray(shapeData)
        ? [shapeData]
        : shapeData.paths;

    paths.forEach(shapePoints => {
        const polyline = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "polyline"
        );

        const points = shapePoints
            .map(point => {
                const projected = projectPoint(
                    point.lat,
                    point.lon,
                    bounds,
                    container
                );

                return `${projected.x},${projected.y}`;
            })
            .join(" ");

        polyline.setAttribute("points", points);
        polyline.classList.add("route-line");
        polyline.style.stroke = color;

        svg.appendChild(polyline);
    });

    container.appendChild(svg);
}

function renderStations(container, stations, bounds, color) {
    stations.forEach(station => {
        const point = projectPoint(
            station.lat,
            station.lon,
            bounds,
            container
        );

        const element =
            document.createElement("div");

        element.classList.add("map-station");

        element.style.left = `${point.x}px`;
        element.style.top = `${point.y}px`;

        element.innerHTML = `
            <div
                class="station-dot"
                style="border-color: ${color}">
            </div>

            <div class="station-name">
                ${station.name}
            </div>
        `;

        container.appendChild(element);
    });
}

function createTrainMarker(train, color) {
    const marker = document.createElement("div");

    marker.classList.add(
        "train-marker",
        train.direction
    );

    marker.innerHTML = `
        <div
            class="train-compact"
            style="border-color: ${color}"
        >
            <span
                class="train-arrow"
                style="color: ${color}"
            >
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
                    ? `<div class="tooltip-status approaching">
                        Approaching
                       </div>`
                    : ""
            }

            ${
                train.delayed
                    ? `<div class="tooltip-status delayed">
                        Delayed
                       </div>`
                    : ""
            }
        </div>
    `;

    return marker;
}

function renderTrains(
    container,
    trains,
    bounds,
    color
) {
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
            bounds,
            container
        );

        const marker =
            createTrainMarker(train, color);

        marker.style.left = `${point.x}px`;
        marker.style.top = `${point.y}px`;

        container.appendChild(marker);
    });
}

export function renderLine(
    container,
    line,
    bounds
) {
    drawRoute(
        container,
        line.shapePoints,
        bounds,
        line.color
    );

    renderStations(
        container,
        line.stations,
        bounds,
        line.color
    );

    renderTrains(
        container,
        line.trains,
        bounds,
        line.color
    );
}