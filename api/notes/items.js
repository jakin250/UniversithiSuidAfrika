const { makeCollectionHandler } = require("../_lib/crud");

module.exports = makeCollectionHandler({
  key: "notes:items",
  required: ["title", "course", "content"],
  build(body) {
    return {
      title: String(body.title || "").trim(),
      course: String(body.course || "").trim(),
      module: String(body.module || "").trim(),
      chapter: String(body.chapter || "").trim(),
      noteType: String(body.noteType || "Study notes").trim(),
      content: String(body.content || "").trim(),
      fileUrl: String(body.fileUrl || "").trim(),
      rating: 0,
      comments: 0,
    };
  },
});
