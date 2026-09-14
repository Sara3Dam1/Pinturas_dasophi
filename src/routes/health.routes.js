const express = require("express");

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    servico: "Pinturas da Sophi API",
  });
});

module.exports = router;
