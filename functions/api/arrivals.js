export async function onRequestGet(context) {
    const requestUrl =
        new URL(context.request.url);

    const mapId =
        requestUrl.searchParams.get("mapid");

    if (!mapId) {
        return Response.json(
            { error: "Missing mapid" },
            { status: 400 }
        );
    }

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