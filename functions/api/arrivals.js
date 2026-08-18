/**
 * Handles requests for CTA station arrival predictions.
 *
 * Reads a CTA station map ID from the query string,
 * forwards the request to the CTA Train Tracker API using
 * the server-side API key, and returns the arrival
 * predictions as JSON.
 */
export async function onRequestGet(context) {
    const requestUrl =
        new URL(context.request.url);

    const mapId =
        requestUrl.searchParams.get("mapid");

    /*
     * A station map ID is required to request
     * arrival predictions from the CTA API.
     */
    if (!mapId) {
        return Response.json(
            { error: "Missing mapid" },
            { status: 400 }
        );
    }

    /*
     * Build the CTA Train Tracker arrivals request.
     *
     * The API key remains server-side through the
     * Cloudflare environment variable instead of
     * being exposed to the browser.
     */
    const ctaUrl = new URL(
        "https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx"
    );

    ctaUrl.searchParams.set(
        "key",
        context.env.CTA_API_KEY
    );

    ctaUrl.searchParams.set(
        "mapid",
        mapId
    );

    ctaUrl.searchParams.set(
        "outputType",
        "JSON"
    );

    /*
     * Forward the request to CTA and return
     * the arrival data to the frontend.
     */
    try {
        const response =
            await fetch(ctaUrl);

        if (!response.ok) {
            return Response.json(
                {
                    error:
                        "CTA arrivals request failed"
                },
                {
                    status: response.status
                }
            );
        }

        const data =
            await response.json();

        return Response.json(data);

    } catch (error) {
        return Response.json(
            {
                error:
                    "Unable to retrieve CTA arrivals"
            },
            {
                status: 500
            }
        );
    }
}