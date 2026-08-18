export async function getWeather() {
    const latitude = 41.8781;
    const longitude = -87.6298;

    const params =
        new URLSearchParams({
            latitude,
            longitude,

            current: [
                "temperature_2m",
                "apparent_temperature",
                "weather_code",
                "wind_speed_10m",
                "is_day"
            ].join(","),

            hourly: [
                "precipitation_probability"
            ].join(","),

            temperature_unit: "fahrenheit",
            wind_speed_unit: "mph",

            timezone: "America/Chicago"
        });

    const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params}`
    );

    if (!response.ok) {
        throw new Error(
            "Failed to load weather data"
        );
    }

    const data =
        await response.json();

    const currentTime =
        data.current.time;

    /*
     * Open-Meteo hourly timestamps look like:
     * 2026-08-16T21:00
     *
     * Current weather time may include minutes,
     * so match the current hour.
     */
    const currentHour =
        currentTime.slice(0, 13);

    const hourlyIndex =
        data.hourly.time.findIndex(
            time =>
                time.startsWith(
                    currentHour
                )
        );

    const precipitationProbability =
        hourlyIndex !== -1
            ? data.hourly
                .precipitation_probability[
                    hourlyIndex
                ]
            : null;

    return {
        ...data.current,
        precipitationProbability
    };
}