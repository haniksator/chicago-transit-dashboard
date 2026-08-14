import { getTrains } from "./cta.js";
import { renderLine, getSharedBounds } from "./transit-map.js";

const trainCount = document.getElementById("train-count");
const trainList = document.getElementById("train-list");

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
    }
];

async function loadJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to load ${url}`);
    }

    return response.json();
}

async function loadLine(line) {
    const [stations, shapePoints, trains] =
        await Promise.all([
            loadJson(line.stationsUrl),
            loadJson(line.shapeUrl),
            getTrains(line.id)
        ]);

    return {
        ...line,
        stations,
        shapePoints,
        trains
    };
}

async function loadDashboard() {
    try {
        const loadedLines =
            await Promise.all(lines.map(loadLine));

        const totalTrains =
            loadedLines.reduce(
                (sum, line) => sum + line.trains.length,
                0
            );

        trainCount.textContent =
            `${totalTrains} trains currently active`;

        trainList.innerHTML = "";

        const bounds =
            getSharedBounds(loadedLines);

        loadedLines.forEach(line => {
            renderLine(
                trainList,
                line,
                bounds
            );
        });

    } catch (error) {
        console.error(error);

        trainCount.textContent =
            "Unable to load CTA train data.";
    }
}

loadDashboard();