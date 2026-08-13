import { getTrains } from "./cta.js";

const trainCount = document.getElementById("train-count");
const trainList = document.getElementById("train-list");

/*
 * Loads the static Red Line station data generated from CTA GTFS.
 */
async function getRedLineStations() {
    const response = await fetch("./data/red-line-stations.json");

    if (!response.ok) {
        throw new Error("Failed to load Red Line station data");
    }

    return response.json();
}

/*
 * Loads the station data and live CTA trains,
 * then matches each train to its next station.
 */
async function loadTrains() {
    try {
        const [stations, trains] = await Promise.all([
            getRedLineStations(),
            getTrains("red")
        ]);

        trainCount.textContent =
            `${trains.length} trains currently active`;

        trainList.innerHTML = "";

        stations.forEach(station => {
            const stationElement = document.createElement("div");

            stationElement.classList.add("station");

            /*
             * CTA Train Tracker's nextStationId uses the parent
             * station ID that we stored in red-line-stations.json.
             */
            const stationTrains = trains.filter(
                train => String(train.nextStationId) === String(station.id)
            );

            stationElement.innerHTML = `
                <div class="station-row">
                    <div class="station-track">
                        <div class="station-dot"></div>
                    </div>

                    <div class="station-content">
                        <div class="station-info">
                            <h3>${station.name}</h3>
                        </div>

                        <div class="station-trains">
                            ${
                                stationTrains.length === 0
                                    ? ""
                                    : stationTrains.map(train => `
                                        <div class="train">
                                            <div class="train-title">
                                                Train ${train.runNumber}
                                            </div>

                                            <div class="train-details">
                                                <span>to ${train.destination}</span>

                                                ${
                                                    train.approaching
                                                        ? `<span class="train-status approaching">
                                                            Approaching
                                                           </span>`
                                                        : ""
                                                }

                                                ${
                                                    train.delayed
                                                        ? `<span class="train-status delayed">
                                                            Delayed
                                                           </span>`
                                                        : ""
                                                }
                                            </div>
                                        </div>
                                    `).join("")
                            }
                        </div>
                    </div>
                </div>
            `;

            trainList.appendChild(stationElement);
        });

    } catch (error) {
        console.error(error);

        trainCount.textContent =
            "Uh-oh, unable to load CTA train data.";
    }
}

loadTrains();