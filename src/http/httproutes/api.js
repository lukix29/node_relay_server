const Path = require("path");
const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => {
    res.json({"api": "Hello!"});
});

router.get('/*.*', (req, res, next) => {
    res.sendFile(Path.resolve('./html/error.html'));
});

module.exports = router;
module.exports.defaultPath = "/api";
