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

    return trains.map(train => ({
        runNumber: train.rn,
        destination: train.destNm,
        nextStation: train.nextStaNm,
        nextStationId: train.nextStaId,
        arrivalTime: train.arrT,
        predictionTime: train.prdt,
        approaching: train.isApp === "1",
        delayed: train.isDly === "1",
        latitude: Number(train.lat),
        longitude: Number(train.lon),
        heading: Number(train.heading)
    }));
}