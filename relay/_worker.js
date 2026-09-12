export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const headers = new Headers(request.headers);
      headers.delete("host");
      const init = { method: request.method, headers, redirect: "manual" };
      if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;
      const resp = await fetch("https://tokup.net" + url.pathname + url.search, init);
      return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
    } catch (e) {
      return new Response("relay_error: " + (e && e.message ? e.message : String(e)), { status: 502 });
    }
  }
};
