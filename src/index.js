export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const inputCode = (url.searchParams.get("code") || "285A")
      .trim()
      .toUpperCase();

    const code = inputCode.length === 4 ? `${inputCode}0` : inputCode;

    if (!env.JQUANTS_API_KEY) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "JQUANTS_API_KEYが設定されていません"
        },
        500
      );
    }

    const apiUrl = new URL(
      "https://api.jquants.com/v2/equities/bars/daily"
    );

    apiUrl.searchParams.set("code", code);

    try {
      const response = await fetch(apiUrl.toString(), {
        headers: {
          "x-api-key": env.JQUANTS_API_KEY,
          Accept: "application/json"
        }
      });

      const result = await response.json();

      if (!response.ok) {
        return jsonResponse(
          {
            status: "ERROR",
            jquantsStatus: response.status,
            details: result
          },
          response.status
        );
      }

      const prices = Array.isArray(result.data) ? result.data : [];

      if (prices.length === 0) {
        return jsonResponse(
          {
            status: "ERROR",
            requestedCode: inputCode,
            message: "株価データが見つかりません"
          },
          404
        );
      }

      prices.sort((a, b) => new Date(a.Date) - new Date(b.Date));

      const latest = prices[prices.length - 1];
      const previous = prices.length >= 2 ? prices[prices.length - 2] : null;

      const latestClose = Number(latest.AdjC ?? latest.C);
      const previousClose = previous
        ? Number(previous.AdjC ?? previous.C)
        : null;

      const change =
        previousClose !== null ? latestClose - previousClose : null;

      const changePercent =
        previousClose
          ? (change / previousClose) * 100
          : null;

      return jsonResponse({
        status: "OK",
        requestedCode: inputCode,
        jquantsCode: code,
        latest: {
          date: latest.Date,
          open: latest.AdjO ?? latest.O,
          high: latest.AdjH ?? latest.H,
          low: latest.AdjL ?? latest.L,
          close: latestClose,
          volume: latest.AdjVo ?? latest.Vo
        },
        previousClose,
        change,
        changePercent:
          changePercent !== null
            ? Number(changePercent.toFixed(2))
            : null,
        recentPrices: prices.slice(-10).reverse().map((price) => ({
          date: price.Date,
          open: price.AdjO ?? price.O,
          high: price.AdjH ?? price.H,
          low: price.AdjL ?? price.L,
          close: price.AdjC ?? price.C,
          volume: price.AdjVo ?? price.Vo
        }))
      });
    } catch (error) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "株価データの取得処理に失敗しました",
          detail: error instanceof Error ? error.message : String(error)
        },
        500
      );
    }
  }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });
}
