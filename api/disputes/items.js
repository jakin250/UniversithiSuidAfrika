const { makeCollectionHandler } = require("../_lib/crud");

module.exports = makeCollectionHandler({
  key: "disputes:items",
  required: ["title", "reason"],
  build(body) {
    return {
      title: String(body.title || "").trim(),
      orderId: String(body.orderId || "").trim(),
      reason: String(body.reason || "").trim(),
      evidenceUrl: String(body.evidenceUrl || "").trim(),
      resolution: "under review",
    };
  },
});
