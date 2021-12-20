const express = require("express");
const path = require("path");
const fs = require("fs");
const settings = require("../../settings");

const router = express.Router();

function getStorage() {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname + "/../.." + settings.storagePath), "utf-8"));
}

router.get("/", (request, response) => {
  const storage = getStorage();
  response.json({ state: storage });
})

router.get("/brokers", ((request, response) => {
  const storage = getStorage();
  response.json({ success: true, data: storage.brokers });
}))

module.exports = router;
