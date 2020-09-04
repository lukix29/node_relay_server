const Url = require('url');
const VideoWebSocket = require("../videowebsocket");
const FlvSession = require("../../codecs/flv_session");

class FlvOutgestWebSocket extends VideoWebSocket {
    constructor() {
        super("flvoutgest");
    }

    onConnection(res, req) {
        req.nmsConnectionType = 'ws';
        req.url = req.url.replace("flvoutgest", "");
        let session = new FlvSession(req, res);
        session.run();
    }
}

module.exports = FlvOutgestWebSocket;
