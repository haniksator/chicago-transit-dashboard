import { getTrains } from "./cta.js";

const trainCount = document.getElementById("train-count");
const trainList = document.getElementById("train-list");

async function loadTrains() {
    try {
        const trains = await getTrains("red");

        trainCount.textContent = `${trains.length} trains currently active`;

        trainList.innerHTML = "";

        trains.forEach(train => {
            const trainElement = document.createElement("div");

            trainElement.innerHTML = `
                <h3>Train ${train.runNumber}</h3>
                <p>Destination: ${train.destination}</p>
                <p>Next Station: ${train.nextStation}</p>
                <p>Approaching: ${train.approaching ? "Yes" : "No"}</p>
                <p>Delayed: ${train.delayed ? "Yes" : "No"}</p>
                <p>Position: ${train.latitude}, ${train.longitude}</p>
            `;

            trainList.appendChild(trainElement);
        });

    } catch (error) {
        console.error(error);

        trainCount.textContent = "Unable to load train data.";
    }
}

loadTrains();