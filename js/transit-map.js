let selectedStationElement = null;

/* ============
   CONSTANTS
   ============ */

const LOOP_TRACK_COLOR = "#555";

/* ========================
   GEOGRAPHY & PROJECTIONS
   ======================== */

/*
 * Calculates the geographic bounds shared by all
 * loaded CTA routes.
 *
 * Station coordinates and route shape points are
 * included so every map element can use the same
 * latitude and longitude range.
 */
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

/*
 * Converts a geographic latitude/longitude coordinate
 * into pixel coordinates within the transit map.
 *
 * Longitude is corrected for Chicago's latitude and a
 * shared scale is used to preserve the map's geographic
 * proportions while leaving padding around the edges.
 */
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
 * Calculates the normalized direction of a route path
 * around a particular projected point.
 *
 * This tangent is used to determine the perpendicular
 * direction needed when visually offsetting shared routes.
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

/*
 * Splits a route shape into continuous segments containing
 * only points that satisfy the provided condition.
 *
 * This allows portions of the original GTFS geometry to be
 * removed and later replaced with canonical shared corridors.
 */
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

/*
 * Projects a geographic route path and draws it as an SVG
 * polyline.
 *
 * An optional perpendicular pixel offset can be applied so
 * multiple CTA lines sharing the same physical track remain
 * individually visible.
 */
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


/* =========================
   LINE & STATION LOOKUPS
   ========================= */

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

/*
 * Combines duplicate physical stations that appear in
 * multiple CTA line datasets.
 *
 * Each returned station contains a list of all CTA lines
 * that serve it, allowing transfer stations to be rendered
 * once instead of once per route.
 */
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

/*
 * Removes route suffixes such as "(Red)" or "(Brown)"
 * from station names before displaying them on the map.
 */
function getDisplayStationName(name) {
    return name
        .replace(/\s*\([^)]*\)\s*$/, "")
        .trim();
}

/* ========================
   SHARED ROUTE CORRIDORS
   ========================  */

/*
 * Returns the station boundaries for the Red/Purple
 * shared corridor between Howard and Belmont.
 */
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

/*
 * Returns the station boundaries for the shared
 * Red/Brown/Purple corridor between Belmont and Fullerton.
 */
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

/*
 * Returns the station boundaries for the Brown/Purple
 * shared corridor between Fullerton and Merchandise Mart.
 */
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

/*
 * Determines whether a route shape point lies within the
 * north/south latitude range defined by two stations.
 *
 * Used to isolate the shared North Side track corridors.
 */
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


/* ==================
   DOWNTOWN LOOP
   ================== */

/*
 * Calculates a small geographic bounding box around the
 * downtown CTA Loop.
 *
 * The bounds are derived from the Loop stations and used
 * to remove original overlapping route geometry before the
 * Loop is redrawn as one canonical track.
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

/*
 * Finds two separate passes of the same station along an
 * ordered GTFS route shape.
 *
 * Loop routes can pass the same location more than once.
 * The two sufficiently separated indices allow the section
 * between those passes to be isolated as the Loop circuit.
 */
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

/*
 * Extracts one canonical geometry for the downtown Loop
 * from the Brown Line GTFS shape.
 *
 * The portion between Brown's two Merchandise Mart passes
 * represents the full Loop circuit and is reused instead of
 * drawing several overlapping route shapes.
 */
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


/* ====================
   ROUTE RENDERING
   ==================== */

/**
 * Draws the ordinary, non-shared portions of every CTA route.
 *
 * Geometry belonging to the North Side shared corridors or
 * downtown Loop is removed here so those sections can be
 * redrawn separately using cleaner canonical paths.
 */
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

/*
 * Draws the Howard-to-Belmont shared corridor using one
 * canonical path with small visual offsets for the Red
 * and Purple Lines.
 */
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

/*
 * Draws the Belmont-to-Fullerton shared corridor using
 * Red Line geometry as the canonical path.
 *
 * Brown, Red, and Purple are offset from that same path so
 * all three services remain visible on the map.
 */
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

/*
 * Draws the Fullerton-to-Merchandise Mart shared corridor
 * using one canonical path with separate Brown and Purple
 * visual offsets.
 */
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

/*
 * Draws the downtown Loop as one neutral shared track.
 *
 * Individual Loop route colors are intentionally omitted
 * here to avoid stacking several lines on the same geometry.
 * Line information is instead exposed through station data.
 */
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

/*
 * Draws a route directly from its original GTFS geometry.
 *
 * Used when the map is filtered to one CTA line, where
 * shared-track visual separation is no longer necessary.
 */
function drawSingleRoute(
    svg,
    container,
    line,
    bounds
) {
    const paths =
        getShapePaths(
            line.shapePoints
        );

    paths.forEach(path => {
        drawPath(
            svg,
            path,
            bounds,
            container,
            line.color
        );
    });
}

/*
 * Renders CTA route geometry for the current map view.
 *
 * Single-line views use the route's original GTFS shape.
 * The full-system view reconstructs shared North Side
 * corridors and the downtown Loop to reduce overlapping
 * route geometry.
 */
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
     * If the user filtered the map down
     * to one CTA line, draw that line's
     * original GTFS geometry.
     *
     * Shared-corridor replacements are
     * only needed in the full system view.
     */
    if (lines.length === 1) {
        drawSingleRoute(
            svg,
            container,
            lines[0],
            bounds
        );

        container.appendChild(svg);

        return;
    }

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
   STATION CLASSIFICATION
   ========================== */

function isDowntownStation(station) {
    return (
        station.lat >= 41.87 &&
        station.lat <= 41.90 &&
        station.lon >= -87.64 &&
        station.lon <= -87.62
    );
}

/*
 * Identifies Loop stations that need higher stacking
 * priority because nearby downtown station hitboxes would
 * otherwise interfere with interaction.
 */
function isPriorityLoopStation(station) {
    const names = new Set([
        "LaSalle/Van Buren",
        "Harold Washington Library-State/Van Buren"
    ]);

    return names.has(
        getDisplayStationName(station.name)
    );
}

/*
 * Identifies the physical stations that make up the
 * downtown CTA Loop.
 */
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

/*
 * Determines a station tooltip orientation based on the
 * direction of nearby route segments.
 *
 * Neighboring stations across all serving lines are used
 * to estimate whether the local track is primarily
 * horizontal or vertical.
 */
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


/* =====================
   STATION RENDERING
   ===================== */

/*
 * Renders each physical CTA station once.
 *
 * Stations shared by multiple routes are merged before
 * rendering so transfer locations do not produce duplicate
 * markers.
 */
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

/* ================
   LIVE TRAINS
   ================ */

/*
 * Creates the visual marker and hover tooltip for one
 * live CTA train.
 *
 * The marker uses the train's heading to show its actual
 * direction of travel while the tooltip displays route,
 * destination, next station, ETA, and delay information.
 */
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

/*
 * Projects and renders a collection of live trains onto
 * the geographic map.
 *
 * Tooltip direction is adjusted based on each marker's
 * location so hover cards remain inside the map boundary.
 */
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

        const point =
            projectPoint(
                train.latitude,
                train.longitude,
                bounds,
                container
            );

        const marker =
            createTrainMarker(
                train,
                color,
                lineName
            );

        marker.style.left =
            `${point.x}px`;

        marker.style.top =
            `${point.y}px`;


        /*
         * --------------------------------
         * HORIZONTAL TOOLTIP POSITION
         * --------------------------------
         *
         * Trains on the left half of the
         * map open tooltips to the right.
         *
         * Trains on the right half open
         * tooltips to the left.
         */

        const mapMidpoint =
            container.clientWidth / 2;

        if (point.x > mapMidpoint) {
            marker.classList.add(
                "tooltip-left"
            );
        } else {
            marker.classList.add(
                "tooltip-right"
            );
        }


        /*
         * --------------------------------
         * VERTICAL TOOLTIP POSITION
         * --------------------------------
         *
         * Prevent tooltips near the top or
         * bottom from being clipped.
         */

        const verticalPadding = 120;

        if (point.y < verticalPadding) {
            marker.classList.add(
                "tooltip-below"
            );
        } else if (
            point.y >
            container.clientHeight -
                verticalPadding
        ) {
            marker.classList.add(
                "tooltip-above"
            );
        }


        container.appendChild(marker);
    });
}

/*
 * Renders all currently active trains for one CTA line
 * using that line's name and display color.
 */
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

/* =========================
   MAP BACKGROUND
   ========================= */

/*
 * Renders the decorative geographic context beneath the
 * CTA system map.
 *
 * Creates a subtle major/minor grid and a simplified
 * Lake Michigan shoreline using the same projection as
 * the transit network so the background remains aligned.
 */
export function renderChicagoBackground(
    container,
    bounds
) {
    const svg =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );

    svg.classList.add(
        "map-background-svg"
    );


    /*
     * --------------------------------
     * BACKGROUND GRID
     * --------------------------------
     */

    const width =
        container.clientWidth;

    const height =
        container.clientHeight;

    const minorSpacing = 50;
    const majorSpacing = 200;

    /*
     * Horizontal lines.
     */
    for (
        let y = 0;
        y <= height;
        y += minorSpacing
    ) {
        const line =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line"
            );

        line.setAttribute("x1", 0);
        line.setAttribute("y1", y);
        line.setAttribute("x2", width);
        line.setAttribute("y2", y);

        if (y % majorSpacing === 0) {
            line.classList.add(
                "map-grid-line",
                "major"
            );
        } else {
            line.classList.add(
                "map-grid-line",
                "minor"
            );
        }

        svg.appendChild(line);
    }

    /*
     * Vertical lines.
     */
    for (
        let x = 0;
        x <= width;
        x += minorSpacing
    ) {
        const line =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line"
            );

        line.setAttribute("x1", x);
        line.setAttribute("y1", 0);
        line.setAttribute("x2", x);
        line.setAttribute("y2", height);

        if (x % majorSpacing === 0) {
            line.classList.add(
                "map-grid-line",
                "major"
            );
        } else {
            line.classList.add(
                "map-grid-line",
                "minor"
            );
        }

        svg.appendChild(line);
    }

    /*
     * --------------------------------
     * SIMPLIFIED LAKE MICHIGAN
     * --------------------------------
     *
     * Stylized shoreline rather than a
     * GIS-accurate coastline.
     */

    const shoreline = [
        { lat: 42.05, lon: -87.665 },
        { lat: 42.02, lon: -87.655 },
        { lat: 41.99, lon: -87.640 },
        { lat: 41.96, lon: -87.635 },
        { lat: 41.93, lon: -87.625 },
        { lat: 41.90, lon: -87.615 },
        { lat: 41.88, lon: -87.605 },
        { lat: 41.85, lon: -87.600 },
        { lat: 41.82, lon: -87.595 },
        { lat: 41.78, lon: -87.585 },
        { lat: 41.74, lon: -87.575 }
    ];

    const shorelinePoints =
        shoreline.map(point =>
            projectPoint(
                point.lat,
                point.lon,
                bounds,
                container
            )
        );

    const topRight = {
        x: container.clientWidth,
        y: 0
    };

    const bottomRight = {
        x: container.clientWidth,
        y: container.clientHeight
    };

    const lakePoints = [
        {
            x: shorelinePoints[0].x,
            y: 0
        },

        ...shorelinePoints,

        {
            x:
                shorelinePoints[
                    shorelinePoints.length - 1
                ].x,

            y:
                container.clientHeight
        },

        bottomRight,
        topRight
    ]

    const lake =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "polygon"
        );

    lake.setAttribute(
        "points",
        lakePoints
    );

    lake.classList.add(
        "lake-michigan"
    );

    svg.appendChild(lake);


    /*
     * Shoreline stroke.
     */

    const extendedShorelinePoints = [
        {
            x: shorelinePoints[0].x,
            y: 0
        },

        ...shorelinePoints,

        {
            x:
                shorelinePoints[
                    shorelinePoints.length - 1
                ].x,
            y: container.clientHeight
        }
    ];


    const coast =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "polyline"
        );

    coast.setAttribute(
        "points",
        extendedShorelinePoints
            .map(
                point =>
                    `${point.x},${point.y}`
            )
            .join(" ")
    );

    coast.classList.add(
        "lake-shoreline"
    );

    svg.appendChild(coast);


    /*
     * Lake label.
     */

    const lakeLabelPoint =
        projectPoint(
            41.91,
            -87.60,
            bounds,
            container
        );

    const lakeLabel =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
        );

    lakeLabel.setAttribute(
        "x",
        lakeLabelPoint.x
    );

    lakeLabel.setAttribute(
        "y",
        lakeLabelPoint.y
    );

    lakeLabel.textContent =
        "Lake Michigan";

    lakeLabel.classList.add(
        "lake-label"
    );

    svg.appendChild(lakeLabel);


    container.appendChild(svg);
}