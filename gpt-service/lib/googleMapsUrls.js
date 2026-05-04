/**
 * Google Maps link + embed URL from a free-text place query.
 */
function buildGoogleMapsUrls(searchQuery) {
  const q = String(searchQuery || "").trim();
  if (q.length < 2) {
    return { map_url: "", embed_url: "" };
  }
  const enc = encodeURIComponent(q);
  return {
    map_url: `https://www.google.com/maps?q=${enc}`,
    embed_url: `https://www.google.com/maps?q=${enc}&output=embed`,
  };
}

/**
 * Best query for maps: location first, then region, countries, context.
 */
function resolveMapsQuery(diagramData) {
  const d = diagramData || {};
  const loc = String(d.location || "").trim();
  if (loc.length >= 2) return loc;
  const reg = String(d.region || "").trim();
  if (reg.length >= 2) return reg;
  if (Array.isArray(d.countries) && d.countries.length) {
    return d.countries
      .map((c) => String(c).trim())
      .filter(Boolean)
      .join(", ");
  }
  const ctx = String(d.context || "").trim();
  if (ctx.length >= 2) return ctx;
  return "";
}

module.exports = { buildGoogleMapsUrls, resolveMapsQuery };
