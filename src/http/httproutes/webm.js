const Path = require("path");
const express = require('express');
const router = express.Router();

function sendAssetFile(req, res) {
    res.sendFile(Path.resolve(Path.join("./html/webm/", req.url)));
}

router.get('/', (req, res, next) => {
    res.sendFile(Path.resolve("./html/webm/index.html"));
});

router.get('/*/*.js', sendAssetFile);
router.get('/*/*.css', sendAssetFile);

// router.get('/*.flv', (req, res, next) => {
//     req.nmsConnectionType = 'http';
//     let session = new FlvSession(req, res);
//     session.run();
// });

module.exports = router;
module.exports.defaultPath = "/webm";
