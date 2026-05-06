const { makeCollectionHandler } = require("../_lib/crud");

module.exports = makeCollectionHandler({
  key: "orders:items",
  required: ["title", "amount"],
  build(body) {
    return {
      title: String(body.title || "").trim(),
      listingType: String(body.listingType || "marketplace").trim(),
      listingId: String(body.listingId || "").trim(),
      amount: Number(body.amount || 0),
      paymentProvider: "Flutterwave",
      escrowStatus: "pending payment",
      deliveryStatus: "pending",
      disputeStatus: "none",
    };
  },
});
