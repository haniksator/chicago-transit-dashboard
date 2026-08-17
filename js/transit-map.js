let selectedStationElement = null;

/* =========================
   =       CONSTANTS       =
   ========================= */

const LOOP_TRACK_COLOR = "#555";

/* ==========================
   = GEOGRAPHY & PROJECTION =
   ========================== */

export function getSharedBounds(lines) {
    const points = [];

    lines.forEach(line => {
        line.stations.forEach(station => {
            points.push({
                lat: station.lat,
                lon: station.lon
            });
        });

        const paths = Array.isArray(line.shapePoints)
            ? [line.shapePoints]
            : line.shapePoints.paths;

        paths.forEach(path => {
            path.forEach(point => {
                points.push(point);
            });
        });
    });

    const lats = points.map(point => point.lat);
    const lons = points.map(point => point.lon);

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

    return {
        x,
        y,
        lat,
        lon
    };
}

function getShapePaths(shapeData) {
    return Array.isArray(shapeData)
        ? [shapeData]
        : shapeData.paths;
}

/*
 * Returns the direction of the track
 * at one particular shape point.
 */
function getTangent(path, index) {
    const previous =
        path[Math.max(0, index - 1)];

    const next =
        path[Math.min(
            path.length - 1,
            index + 1
        )];

    const dx = next.x - previous.x;
    const dy = next.y - previous.y;

    const length =
        Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
        return {
            x: 0,
            y: 0
        };
    }

    return {
        x: dx / length,
        y: dy / length
    };
}

function splitPathByCondition(
    path,
    shouldKeep
) {
    const segments = [];

    let currentSegment = [];

    path.forEach(point => {
        if (shouldKeep(point)) {
            currentSegment.push(point);
        } else {
            if (currentSegment.length >= 2) {
                segments.push(currentSegment);
            }

            currentSegment = [];
        }
    });

    if (currentSegment.length >= 2) {
        segments.push(currentSegment);
    }

    return segments;
}

function drawPath(
    svg,
    path,
    bounds,
    container,
    color,
    offset = 0
) {
    const projectedPath =
        path.map(point =>
            projectPoint(
                point.lat,
                point.lon,
                bounds,
                container
            )
        );

    const points =
        projectedPath
            .map((point, index) => {
                if (offset === 0) {
                    return `${point.x},${point.y}`;
                }

                const tangent =
                    getTangent(
                        projectedPath,
                        index
                    );

                const normal = {
                    x: -tangent.y,
                    y: tangent.x
                };

                const x =
                    point.x +
                    normal.x * offset;

                const y =
                    point.y +
                    normal.y * offset;

                return `${x},${y}`;
            })
            .join(" ");

    const polyline =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "polyline"
        );

    polyline.setAttribute(
        "points",
        points
    );

    polyline.classList.add(
        "route-line"
    );

    polyline.style.stroke = color;

    svg.appendChild(polyline);
}


/* ==========================
   = LINE & STATION LOOKUPS =
   ========================== */

function getLine(lines, id) {
    return lines.find(line => line.id === id);
}

function findStation(lines, lineId, stationId) {
    const line = lines.find(
        line => line.id === lineId
    );

    if (!line) {
        return null;
    }

    return line.stations.find(
        station =>
            String(station.id) ===
            String(stationId)
    );
}

function findStationByName(
    lines,
    lineId,
    stationName
) {
    const line = getLine(lines, lineId);

    if (!line) {
        return null;
    }

    return line.stations.find(
        station =>
            getDisplayStationName(station.name) ===
            stationName
    );
}

function mergeStations(lines) {
    const stationMap = new Map();

    lines.forEach(line => {
        line.stations.forEach(station => {
            if (!stationMap.has(station.id)) {
                stationMap.set(station.id, {
                    ...station,
                    lines: []
                });
            }

            const mergedStation =
                stationMap.get(station.id);

            mergedStation.lines.push({
                id: line.id,
                name: line.name,
                color: line.color
            });
        });
    });

    return Array.from(stationMap.values());
}

function getDisplayStationName(name) {
    return name
        .replace(/\s*\([^)]*\)\s*$/, "")
        .trim();
}


/* ==========================
   = SHARED ROUTE CORRIDORS =
   ==========================  */

function getRedPurpleAnchors(lines) {
    const howard = findStation(
        lines,
        "red",
        "40900"
    );

    const belmont = findStation(
        lines,
        "red",
        "41320"
    );

    if (!howard || !belmont) {
        return null;
    }

    return {
        north: howard,
        south: belmont
    };
}

function getRedBrownPurpleAnchors(lines) {
    const belmont = findStation(
        lines,
        "red",
        "41320"
    );

    const fullerton = findStation(
        lines,
        "red",
        "41220"
    );

    if (!belmont || !fullerton) {
        return null;
    }

    return {
        north: belmont,
        south: fullerton
    };
}

function getBrownPurpleAnchors(lines) {
    const fullerton = findStation(
        lines,
        "brn",
        "41220"
    );

    const merchandiseMart = findStation(
        lines,
        "brn",
        "40460"
    );

    if (!fullerton || !merchandiseMart) {
        return null;
    }

    return {
        north: fullerton,
        south: merchandiseMart
    };
}

function isBetweenStations(
    point,
    stationA,
    stationB
) {
    const minLat = Math.min(
        stationA.lat,
        stationB.lat
    );

    const maxLat = Math.max(
        stationA.lat,
        stationB.lat
    );

    return (
        point.lat >= minLat &&
        point.lat <= maxLat
    );
}


/* =========================
   =     DOWNTOWN LOOP     =
   ========================= */

/*
 * The main CTA Loop stations.
 *
 * We use these to calculate a small geographic
 * region containing the Loop.
 */
function getLoopBounds(lines) {
    const stationNames = [
        "Clark/Lake",
        "Washington/Wabash",
        "Adams/Wabash",
        "Harold Washington Library-State/Van Buren",
        "LaSalle/Van Buren",
        "Quincy",
        "Washington/Wells"
    ];

    const stations = stationNames
        .map(name =>
            findStationByName(
                lines,
                "brn",
                name
            )
        )
        .filter(Boolean);

    if (stations.length === 0) {
        return null;
    }

    const lats =
        stations.map(station => station.lat);

    const lons =
        stations.map(station => station.lon);

    /*
     * Small padding so the GTFS track itself
     * falls inside the station-derived bounds.
     */
    const padding = 0.0015;

    return {
        minLat:
            Math.min(...lats) - padding,

        maxLat:
            Math.max(...lats) + padding,

        minLon:
            Math.min(...lons) - padding,

        maxLon:
            Math.max(...lons) + padding
    };
}

function isInsideBounds(point, bounds) {
    if (!bounds) {
        return false;
    }

    return (
        point.lat >= bounds.minLat &&
        point.lat <= bounds.maxLat &&
        point.lon >= bounds.minLon &&
        point.lon <= bounds.maxLon
    );
}

function findTwoPathPasses(
    path,
    station
) {
    const candidates =
        path.map((point, index) => {
            const latDiff =
                point.lat - station.lat;

            const lonDiff =
                point.lon - station.lon;

            return {
                index,
                distance:
                    latDiff * latDiff +
                    lonDiff * lonDiff
            };
        })
        .sort(
            (a, b) =>
                a.distance - b.distance
        );

    if (candidates.length < 2) {
        return null;
    }

    const first =
        candidates[0];

    /*
     * Find another occurrence of the
     * station significantly farther along
     * the ordered GTFS shape.
     *
     * This prevents selecting two neighboring
     * points from the same pass.
     */
    const second =
        candidates.find(
            candidate =>
                Math.abs(
                    candidate.index -
                    first.index
                ) > 20
        );

    if (!second) {
        return null;
    }

    return {
        startIndex: Math.min(
            first.index,
            second.index
        ),

        endIndex: Math.max(
            first.index,
            second.index
        )
    };
}


function getCanonicalLoopPath(
    lines
) {
    const brownLine =
        getLine(lines, "brn");

    if (!brownLine) {
        return null;
    }

    const merchandiseMart =
        findStation(
            lines,
            "brn",
            "40460"
        );

    if (!merchandiseMart) {
        return null;
    }

    const brownPaths =
        getShapePaths(
            brownLine.shapePoints
        );

    /*
     * Brown currently has one complete
     * circuit path in our GTFS extraction.
     */
    const brownPath =
        brownPaths[0];

    if (!brownPath) {
        return null;
    }

    const passes =
        findTwoPathPasses(
            brownPath,
            merchandiseMart
        );

    if (!passes) {
        return null;
    }

    /*
     * Everything between Brown's two
     * Merchandise Mart passes is the
     * actual downtown Loop circuit.
     */
    return brownPath.slice(
        passes.startIndex,
        passes.endIndex + 1
    );
}


/* =========================
   =    ROUTE RENDERING    =
   ========================= */

function drawNormalRouteSections(
    svg,
    container,
    lines,
    bounds,
    redPurpleAnchors,
    redBrownPurpleAnchors,
    brownPurpleAnchors,
    loopBounds
) {
    const loopLineIds =
        new Set([
            "brn",
            "g",
            "org",
            "pink",
            "p"
        ]);

    lines.forEach(line => {
        const paths =
            getShapePaths(
                line.shapePoints
            );

        paths.forEach(path => {
            const segments =
                splitPathByCondition(
                    path,
                    point => {
                        /*
                         * Red:
                         * remove Howard -> Belmont
                         * and Belmont -> Fullerton.
                         */
                        if (line.id === "red") {
                            const redPurple =
                                redPurpleAnchors &&
                                isBetweenStations(
                                    point,
                                    redPurpleAnchors.north,
                                    redPurpleAnchors.south
                                );

                            const threeLine =
                                redBrownPurpleAnchors &&
                                isBetweenStations(
                                    point,
                                    redBrownPurpleAnchors.north,
                                    redBrownPurpleAnchors.south
                                );

                            if (
                                redPurple ||
                                threeLine
                            ) {
                                return false;
                            }
                        }


                        /*
                         * Brown:
                         * remove Belmont -> Fullerton,
                         * Fullerton -> Merchandise Mart.
                         */
                        if (line.id === "brn") {
                            const threeLine =
                                redBrownPurpleAnchors &&
                                isBetweenStations(
                                    point,
                                    redBrownPurpleAnchors.north,
                                    redBrownPurpleAnchors.south
                                );

                            const brownPurple =
                                brownPurpleAnchors &&
                                isBetweenStations(
                                    point,
                                    brownPurpleAnchors.north,
                                    brownPurpleAnchors.south
                                );

                            if (
                                threeLine ||
                                brownPurple
                            ) {
                                return false;
                            }
                        }


                        /*
                         * Purple participates in
                         * all three North Side
                         * canonical corridors.
                         */
                        if (line.id === "p") {
                            const redPurple =
                                redPurpleAnchors &&
                                isBetweenStations(
                                    point,
                                    redPurpleAnchors.north,
                                    redPurpleAnchors.south
                                );

                            const threeLine =
                                redBrownPurpleAnchors &&
                                isBetweenStations(
                                    point,
                                    redBrownPurpleAnchors.north,
                                    redBrownPurpleAnchors.south
                                );

                            const brownPurple =
                                brownPurpleAnchors &&
                                isBetweenStations(
                                    point,
                                    brownPurpleAnchors.north,
                                    brownPurpleAnchors.south
                                );

                            if (
                                redPurple ||
                                threeLine ||
                                brownPurple
                            ) {
                                return false;
                            }
                        }


                        /*
                         * Brown / Orange / Pink / Purple:
                         * remove original geometry inside
                         * the Loop.
                         *
                         * We'll redraw it from one
                         * canonical path later.
                         */
                        if (
                            loopLineIds.has(line.id) &&
                            isInsideBounds(
                                point,
                                loopBounds
                            )
                        ) {
                            return false;
                        }

                        return true;
                    }
                );

            segments.forEach(segment => {
                drawPath(
                    svg,
                    segment,
                    bounds,
                    container,
                    line.color
                );
            });
        });
    });
}

function drawRedPurpleCorridor(
    svg,
    container,
    bounds,
    redLine,
    purpleLine,
    anchors
) {
    if (
        !redLine ||
        !purpleLine ||
        !anchors
    ) {
        return;
    }

    const redPaths =
        getShapePaths(
            redLine.shapePoints
        );

    redPaths.forEach(redPath => {
        const segments =
            splitPathByCondition(
                redPath,
                point =>
                    isBetweenStations(
                        point,
                        anchors.north,
                        anchors.south
                    )
            );

        segments.forEach(path => {
            drawPath(
                svg,
                path,
                bounds,
                container,
                redLine.color,
                -2
            );

            drawPath(
                svg,
                path,
                bounds,
                container,
                purpleLine.color,
                2
            );
        });
    });
}


function drawRedBrownPurpleCorridor(
    svg,
    container,
    bounds,
    redLine,
    brownLine,
    purpleLine,
    anchors
) {
    if (
        !redLine ||
        !brownLine ||
        !purpleLine ||
        !anchors
    ) {
        return;
    }

    const redPaths =
        getShapePaths(
            redLine.shapePoints
        );

    redPaths.forEach(redPath => {
        const segments =
            splitPathByCondition(
                redPath,
                point =>
                    isBetweenStations(
                        point,
                        anchors.north,
                        anchors.south
                    )
            );

        segments.forEach(path => {
            drawPath(
                svg,
                path,
                bounds,
                container,
                brownLine.color,
                -4
            );

            drawPath(
                svg,
                path,
                bounds,
                container,
                redLine.color,
                0
            );

            drawPath(
                svg,
                path,
                bounds,
                container,
                purpleLine.color,
                4
            );
        });
    });
}

function drawBrownPurpleCorridor(
    svg,
    container,
    bounds,
    brownLine,
    purpleLine,
    anchors
) {
    if (
        !brownLine ||
        !purpleLine ||
        !anchors
    ) {
        return;
    }

    const brownPaths =
        getShapePaths(
            brownLine.shapePoints
        );

    brownPaths.forEach(brownPath => {
        const segments =
            splitPathByCondition(
                brownPath,
                point =>
                    isBetweenStations(
                        point,
                        anchors.north,
                        anchors.south
                    )
            );

        segments.forEach(path => {
            drawPath(
                svg,
                path,
                bounds,
                container,
                brownLine.color,
                -2
            );

            drawPath(
                svg,
                path,
                bounds,
                container,
                purpleLine.color,
                2
            );
        });
    });
}

function drawLoopCorridor(
    svg,
    container,
    lines,
    bounds
) {
    const loopPath =
        getCanonicalLoopPath(lines);

    if (
        !loopPath ||
        loopPath.length < 2
    ) {
        return;
    }

    /*
     * The Loop is represented as one
     * shared piece of infrastructure.
     *
     * Individual CTA line information
     * will be shown through station
     * interaction instead of stacking
     * route colors here.
     */
    drawPath(
        svg,
        loopPath,
        bounds,
        container,
        LOOP_TRACK_COLOR
    );
}

export function renderRoutes(
    container,
    lines,
    bounds
) {
    const svg =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );

    svg.classList.add("route-svg");

    /*
     * Shared-corridor anchors.
     */
    const redPurpleAnchors =
        getRedPurpleAnchors(lines);

    const redBrownPurpleAnchors =
        getRedBrownPurpleAnchors(lines);

    const brownPurpleAnchors =
        getBrownPurpleAnchors(lines);

    const loopBounds =
        getLoopBounds(lines);

    /*
     * Route references.
     */
    const redLine =
        getLine(lines, "red");

    const brownLine =
        getLine(lines, "brn");

    const purpleLine =
        getLine(lines, "p");

    /*
     * 1. Draw every non-shared piece.
     */
    drawNormalRouteSections(
        svg,
        container,
        lines,
        bounds,
        redPurpleAnchors,
        redBrownPurpleAnchors,
        brownPurpleAnchors,
        loopBounds
    );


    /*
     * 2. Howard -> Belmont
     */
    drawRedPurpleCorridor(
        svg,
        container,
        bounds,
        redLine,
        purpleLine,
        redPurpleAnchors
    );


    /*
     * 3. Belmont -> Fullerton
     */
    drawRedBrownPurpleCorridor(
        svg,
        container,
        bounds,
        redLine,
        brownLine,
        purpleLine,
        redBrownPurpleAnchors
    );


    /*
     * 4. Fullerton -> Merchandise Mart
     */
    drawBrownPurpleCorridor(
        svg,
        container,
        bounds,
        brownLine,
        purpleLine,
        brownPurpleAnchors
    );


    /*
     * 5. Downtown Loop
     */
    drawLoopCorridor(
        svg,
        container,
        lines,
        bounds
    );


    container.appendChild(svg);
}

/* ==========================
   = STATION CLASSIFICATION =
   ========================== */

function isDowntownStation(station) {
    return (
        station.lat >= 41.87 &&
        station.lat <= 41.90 &&
        station.lon >= -87.64 &&
        station.lon <= -87.62
    );
}

function isPriorityLoopStation(station) {
    const names = new Set([
        "LaSalle/Van Buren",
        "Harold Washington Library-State/Van Buren"
    ]);

    return names.has(
        getDisplayStationName(station.name)
    );
}

function isLoopStation(station) {
    const loopStationNames = new Set([
        "Washington/Wabash",
        "Clark/Lake",
        "Washington/Wells",
        "Adams/Wabash",
        "Harold Washington Library-State/Van Buren",
        "LaSalle/Van Buren",
        "Quincy"
    ]);

    return loopStationNames.has(
        getDisplayStationName(station.name)
    );
}

function getStationLabelPosition(
    station,
    lines,
    stationIndex
) {
    const nearbyDirections = [];

    lines.forEach(line => {
        const stationIndex = line.stations.findIndex(
            s => String(s.id) === String(station.id)
        );

        if (stationIndex === -1) {
            return;
        }

        const previous =
            line.stations[stationIndex - 1];

        const next =
            line.stations[stationIndex + 1];

        if (!previous && !next) {
            return;
        }

        const reference =
            next || previous;

        const latDiff =
            reference.lat - station.lat;

        const lonDiff =
            reference.lon - station.lon;

        nearbyDirections.push({
            latDiff,
            lonDiff
        });
    });

    if (nearbyDirections.length === 0) {
        return "right";
    }

    const avgLatDiff =
        nearbyDirections.reduce(
            (sum, direction) =>
                sum + Math.abs(direction.latDiff),
            0
        ) / nearbyDirections.length;

    const avgLonDiff =
        nearbyDirections.reduce(
            (sum, direction) =>
                sum + Math.abs(direction.lonDiff),
            0
        ) / nearbyDirections.length;

    if (avgLonDiff > avgLatDiff) {
        return "diagonal";
    }

    return "right";
}


/* =========================
   =   STATION RENDERING   =
   ========================= */

function renderStation(
    container,
    station,
    lines,
    bounds,
    onStationSelect
) {
    const point = projectPoint(
        station.lat,
        station.lon,
        bounds,
        container
    );

    const element =
        document.createElement("div");

    element.classList.add("map-station");

    if (station.lines.length > 1) {
        element.classList.add(
            "transfer-station"
        );
    }

    if (isDowntownStation(station)) {
        element.classList.add("downtown-station");
    }

    if (isLoopStation(station)) {
        element.classList.add(
            "loop-station"
        );
    }

    if (isPriorityLoopStation(station)) {
        element.classList.add(
            "priority-loop-station"
        );
    }

    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;

    const labelPosition =
        getStationLabelPosition(
            station,
            lines
        );

    element.classList.add(
        `label-${labelPosition}`
    );

    const displayName =
        getDisplayStationName(station.name);

    element.innerHTML = `
        <div class="station-dot"></div>

        <div class="station-name">
            ${displayName}
        </div>
    `;

    element.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            if (selectedStationElement) {
                selectedStationElement.classList.remove(
                    "selected-station"
                );
            }

            element.classList.add(
                "selected-station"
            );

            selectedStationElement =
                element;

            if (onStationSelect) {
                onStationSelect(station);
            }
        }
    );

    container.appendChild(element);
}

export function renderStations(
    container,
    lines,
    bounds,
    onStationSelect
) {
    const stations =
        mergeStations(lines);

    stations.forEach(station => {
        renderStation(
            container,
            station,
            lines,
            bounds,
            onStationSelect
        );
    });
}

/* =========================
   =      LIVE TRAINS      =
   ========================= */

function createTrainMarker(
    train,
    color,
    lineName
) {
    const marker =
        document.createElement("div");

    marker.classList.add(
        "train-marker"
    );

    const heading =
        Number.isFinite(train.heading)
            ? train.heading
            : 0;

    const etaText =
        train.approaching
            ? "Approaching"
            : train.minutesToNext !== null
                ? `${train.minutesToNext} min`
                : "Unavailable";

    marker.innerHTML = `
        <div
            class="train-direction"
            style="
                color: ${color};
                transform: rotate(${heading}deg);
            "
        >
            ▲
        </div>

        <div
            class="train-tooltip"
            style="--train-color: ${color};"
        >
            <div class="train-tooltip-header">
                <span class="train-line">
                    ${lineName}
                </span>

                <span class="train-run">
                    Train ${train.runNumber}
                </span>
            </div>

            <div class="train-tooltip-destination">
                Toward ${train.destination}
            </div>

            <div class="train-tooltip-row">
                <span>Next</span>
                <strong>${train.nextStation}</strong>
            </div>

            <div class="train-tooltip-row">
                <span>ETA</span>
                <strong>${etaText}</strong>
            </div>

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

function renderTrains(
    container,
    trains,
    bounds,
    color,
    lineName
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
            createTrainMarker(train, color, lineName);

        marker.style.left = `${point.x}px`;
        marker.style.top = `${point.y}px`;

        container.appendChild(marker);
    });
}

export function renderLineTrains(
    container,
    line,
    bounds
) {
    renderTrains(
        container,
        line.trains,
        bounds,
        line.color,
        line.name
    );
}