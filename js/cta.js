/**
 * Retrieves live train position data for a CTA route.
 *
 * Requests train data from the server-side CTA endpoint
 * and converts the raw CTA response into a simpler format
 * used by the map and train tooltips.
 *
 * @param {string} route - CTA route ID to retrieve.
 * @returns {Promise<Array>} Normalized live train data.
 */
export async function getTrains(route = "red") {
    const response = await fetch(`/api/trains?route=${route}`);

    if (!response.ok) {
        throw new Error("Failed to fetch CTA train data");
    }

    const data = await response.json();

    /*
     * CTA may return a successful HTTP response while
     * still reporting an API-level error in the payload.
     */
    if (data.ctatt.errCd !== "0") {
        throw new Error(data.ctatt.errNm || "CTA API error");
    }

    /*
     * Some CTA responses may not contain any trains,
     * so fall back to an empty array.
     */
    const trains = data.ctatt.route?.[0]?.train ?? [];

    /*
     * Convert each CTA train object into the smaller,
     * consistent structure used throughout the frontend.
     */
    return trains.map(train => {
        const arrivalTime =
            train.arrT
                ? new Date(train.arrT)
                : null;

        const predictionTime =
            train.prdt
                ? new Date(train.prdt)
                : null;

        /*
         * Calculate the estimated number of minutes
         * until the train reaches its next station.
         */
        const minutesToNext =
            arrivalTime && predictionTime
                ? Math.max(
                    0,
                    Math.round(
                        (
                            arrivalTime -
                            predictionTime
                        ) / 60000
                    )
                )
                : null;

        return {
            runNumber: train.rn,
            destination: train.destNm,

            direction:
                train.trDr === "1"
                    ? "northbound"
                    : train.trDr === "5"
                        ? "southbound"
                        : "unknown",

            nextStation: train.nextStaNm,
            nextStationId: train.nextStaId,

            arrivalTime: train.arrT,
            predictionTime: train.prdt,

            minutesToNext,

            approaching:
                train.isApp === "1",

            delayed:
                train.isDly === "1",

            latitude:
                Number(train.lat),

            longitude:
                Number(train.lon),

            heading:
                Number(train.heading)
        };
    });
}

/**
 * Retrieves upcoming arrival predictions for a CTA station.
 *
 * Requests predictions using the station's CTA map ID and
 * converts the raw CTA response into the format used by the
 * Station Details panel.
 *
 * @param {string|number} stationId - CTA parent station map ID.
 * @returns {Promise<Array>} Normalized station arrival predictions.
 */
export async function getStationArrivals(
    stationId
) {
    const response = await fetch(
        `/api/arrivals?mapid=${stationId}`
    );

    if (!response.ok) {
        throw new Error(
            "Failed to fetch CTA station arrivals"
        );
    }

    const data =
        await response.json();

    /*
     * CTA may return no arrival predictions for a
     * station, so fall back to an empty array.
     */
    const predictions =
        data.ctatt?.eta ?? [];

    /*
     * Normalize each prediction and calculate the
     * estimated number of minutes until arrival.
     */
    return predictions.map(train => {
        const arrivalTime =
            new Date(train.arrT);

        const predictionTime =
            new Date(train.prdt);

        const minutes =
            Math.max(
                0,
                Math.round(
                    (
                        arrivalTime -
                        predictionTime
                    ) / 60000
                )
            );

        return {
            runNumber: train.rn,
            route: train.rt,
            destination: train.destNm,

            minutes,

            approaching:
                train.isApp === "1",

            delayed:
                train.isDly === "1",
            scheduled:
                train.isSch === "1"
        };
    });
}