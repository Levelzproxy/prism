/*
 * Adapter for epoxy-transport 3.x.
 *
 * bare-mux 2.x hands a transport the request headers as a plain object
 * (`{ "user-agent": "...", ... }`), while epoxy-transport 3.x iterates a list of
 * [key, value] entries. Passing the object straight through throws
 * "TypeError: headers is not iterable", so normalise it here before delegating.
 */
import EpoxyTransport from "./epoxy.mjs";

function toEntries(headers) {
  if (!headers) return [];
  if (Array.isArray(headers)) return headers;
  if (typeof headers[Symbol.iterator] === "function") return [...headers];
  return Object.entries(headers);
}

export default class EpoxyTransportAdapter extends EpoxyTransport {
  request(remote, method, body, headers, signal) {
    return super.request(remote, method, body, toEntries(headers), signal);
  }

  connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
    return super.connect(
      url,
      protocols,
      toEntries(requestHeaders),
      onopen,
      onmessage,
      onclose,
      onerror
    );
  }
}
