export async function onRequestGet(context) {
    const requestUrl = new URL(context.request.url);

    const route = requestUrl.searchParams.get("route") || "red";

    const ctaUrl = new URL(
        "https://lapi.transitchicago.com/api/1.0/ttpositions.aspx"
    );

    ctaUrl.searchParams.set("key", context.env.CTA_API_KEY);
    ctaUrl.searchParams.set("rt", route);
    ctaUrl.searchParams.set("outputType", "JSON");

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