const Path = require("path");
const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => {
    res.sendFile(Path.resolve('./html/admin/index.html'));
});

router.get('/*/*.*', (req, res, next) => {
    res.sendFile(Path.resolve(Path.join("./html/admin/", req.url)));
});

module.exports = router;
module.exports.defaultPath = "/admin";
