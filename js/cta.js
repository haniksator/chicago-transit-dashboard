export async function getTrains(route = "red") {
    const response = await fetch(`/api/trains?route=${route}`);

    if (!response.ok) {
        throw new Error("Failed to fetch CTA train data");
    }

    const data = await response.json();

    if (data.ctatt.errCd !== "0") {
        throw new Error(data.ctatt.errNm || "CTA API error");
    }

    const trains = data.ctatt.route?.[0]?.train ?? [];

    const apiTime = new Date(data.ctatt.tmst);

    return trains.map(train => {
        const arrivalTime =
            train.arrT
                ? new Date(train.arrT)
                : null;

        const predictionTime =
            train.prdt
                ? new Date(train.prdt)
                : null;

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

    const predictions =
        data.ctatt?.eta ?? [];

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