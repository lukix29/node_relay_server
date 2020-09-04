const Path = require("path");
const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => {
    res.sendFile(Path.resolve('./html/index.html'));
});

router.get('/test', (req, res, next) => {
    res.sendFile(Path.resolve('./html/test/index.html'));
});

module.exports = router;
module.exports.defaultPath = "/";
