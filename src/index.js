export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // URL例: /?code=285A
    const inputCode = (url.searchParams.get("code") || "285A")
      .trim()
      .toUpperCase();

    // J-Quantsでは銘柄コードを5桁形式で扱う
    // 285A → 285A0
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
        method: "GET",
        headers: {
          "x-api-key": env.JQUANTS_API_KEY,
          "Accept": "application/json"
        }
      });

      const responseText = await response.text();

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = {
          rawResponse: responseText
        };
      }

      return jsonResponse(
        {
          status: response.ok ? "OK" : "ERROR",
          requestedCode: inputCode,
          jquantsCode: code,
          jquantsStatus: response.status,
          data
        },
        response.status
      );
    } catch (error) {
      return jsonResponse(
        {
          status: "ERROR",
          message: "J-Quantsへの接続に失敗しました",
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
