/**
 * Retrieves current weather conditions for Chicago.
 *
 * Requests current conditions and hourly precipitation
 * probability from Open-Meteo, then combines the current
 * weather data with the precipitation probability for the
 * corresponding hour.
 */
export async function getWeather() {
    const latitude = 41.8781;
    const longitude = -87.6298;

    /*
     * Build the Open-Meteo request for Chicago.
     *
     * Current conditions provide the primary weather data,
     * while hourly data is requested separately for the
     * precipitation probability.
     */
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

    /*
     * Request weather data from Open-Meteo.
     */
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

    /*
     * Open-Meteo provides precipitation probability
     * as hourly data rather than as part of the current
     * conditions.
     *
     * Match the current weather timestamp to its
     * corresponding hourly forecast entry.
     */
    const currentTime =
        data.current.time;

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

    /*
     * Return a single object containing the current
     * conditions and precipitation probability so the
     * UI does not need to process the raw API response.
     */
    return {
        ...data.current,
        precipitationProbability
    };
}