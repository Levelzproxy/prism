/* global Ultraviolet */
/*
 * Ultraviolet configuration.
 *
 * Paths are derived at runtime from where this file is served, so the same
 * build works on a custom domain (/) and on a GitHub Pages project page
 * (/my-repo/) without editing anything.
 */
(function () {
  // "/" on a user/org page or custom domain, "/repo/" on a project page.
  var base = new URL("./", self.location.href).pathname;

  self.__uv$config = {
    prefix: base + "service/",
    bare: base + "bare/", // unused: bare-mux handles the transport
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: base + "uv/uv.handler.js",
    client: base + "uv/uv.client.js",
    bundle: base + "uv/uv.bundle.js",
    config: base + "uv.config.js",
    sw: base + "uv/uv.sw.js",
  };
})();
