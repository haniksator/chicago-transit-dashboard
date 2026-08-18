/**
 * Handles requests for live CTA train position data.
 *
 * Reads the requested CTA route from the query string,
 * forwards the request to the CTA Train Tracker API using
 * the server-side API key, and returns the response as JSON.
 */
export async function onRequestGet(context) {
    const requestUrl = new URL(context.request.url);

    const route = requestUrl.searchParams.get("route") || "red";

    /*
     * Build the CTA Train Tracker request.
     *
     * The API key stays server-side through the
     * Cloudflare environment variable instead of
     * being exposed to the browser.
     */
    const ctaUrl = new URL(
        "https://lapi.transitchicago.com/api/1.0/ttpositions.aspx"
    );

    ctaUrl.searchParams.set("key", context.env.CTA_API_KEY);
    ctaUrl.searchParams.set("rt", route);
    ctaUrl.searchParams.set("outputType", "JSON");

    /*
     * Forward the request to CTA and return
     * the response to the frontend.
    */
    try {
        const response = await fetch(ctaUrl);

        if (!response.ok) {
            return Response.json(
                { error: "CTA request failed" },
                { status: response.status }
            );
        }

        const data = await response.json();

        return Response.json(data);
    } catch (error) {
        return Response.json(
            { error: "Unable to retrieve CTA data" },
            { status: 500 }
        );
    }
}