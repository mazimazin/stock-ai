export default {
  async fetch(request, env) {
    return new Response(
      JSON.stringify({
        status: "OK",
        apiKeyRegistered: !!env.JQUANTS_API_KEY
      }),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};
