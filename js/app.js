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
    },
    {
        id: "brn",
        name: "Brown Line",
        color: "#62361b",
        stationsUrl: "./data/lines/brown-line-stations.json",
        shapeUrl: "./data/lines/brown-line-shape.json"
    },
    {
        id: "g",
        name: "Green Line",
        color: "#009b3a",
        stationsUrl: "./data/lines/green-stations.json",
        shapeUrl: "./data/lines/green-shape.json"
    },
    {
        id: "org",
        name: "Orange Line",
        color: "#f9461c",
        stationsUrl: "./data/lines/orange-stations.json",
        shapeUrl: "./data/lines/orange-shape.json"
    },
    {
        id: "pink",
        name: "Pink Line",
        color: "#e27ea6",
        stationsUrl: "./data/lines/pink-stations.json",
        shapeUrl: "./data/lines/pink-shape.json"
    },
    {
        id: "p",
        name: "Purple Line",
        color: "#522398",
        stationsUrl: "./data/lines/purple-line-stations.json",
        shapeUrl: "./data/lines/purple-line-shape.json"
    },
    {
        id: "y",
        name: "Yellow Line",
        color: "#f9e300",
        stationsUrl: "./data/lines/yellow-line-stations.json",
        shapeUrl: "./data/lines/yellow-line-shape.json"
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