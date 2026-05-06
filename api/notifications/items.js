const { makeCollectionHandler } = require("../_lib/crud");

module.exports = makeCollectionHandler({
  key: "notifications:items",
  required: ["title"],
  build(body) {
    return {
      title: String(body.title || "").trim(),
      body: String(body.body || "").trim(),
      type: String(body.type || "update").trim(),
      read: false,
    };
  },
});
