const { makeCollectionHandler } = require("../_lib/crud");

module.exports = makeCollectionHandler({
  key: "messages:items",
  required: ["subject", "message"],
  build(body) {
    return {
      subject: String(body.subject || "").trim(),
      listingType: String(body.listingType || "general").trim(),
      listingId: String(body.listingId || "").trim(),
      recipient: String(body.recipient || "seller").trim(),
      message: String(body.message || "").trim(),
      read: false,
    };
  },
});
