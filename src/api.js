export async function fetchDailyBars(code, apiKey) {
  const apiUrl = new URL("https://api.jquants.com/v2/equities/bars/daily");
  apiUrl.searchParams.set("code", code);
  const response = await fetch(apiUrl.toString(), {
    headers: { "x-api-key": apiKey, Accept: "application/json" }
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error(`API応答を読み込めませんでした（${response.status}）`); }
  if (!response.ok) {
    if (response.status === 429) throw new Error("API回数制限です。少し時間を空けて再分析してください");
    throw new Error(`J-Quants APIエラー：${response.status}`);
  }
  const prices = Array.isArray(result.data) ? result.data : [];
  prices.sort((a,b) => new Date(a.Date)-new Date(b.Date));
  return prices;
}

