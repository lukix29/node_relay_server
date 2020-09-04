//const Helpers = require("../../helpers");
const Url = require('url');
const WebSocket = require('ws');

//const WebSockets = require("./websockets");

//function PingTimers(webSockets) {
//     const interval = 30000;
//     var timers = {};
//
//     this.stopTimer = (type) => {
//         if (timers[type]) clearTimeout(timers[type]);
//     };
//
//     this.startTimer = (type, socket) => {
//         socket.isAlive = true;
//         socket.on('pong', () => {
//             socket.isAlive = true;
//         });
//         if (timers[type] === null) {
//             pingClients(type);
//         }
//     };
//
//     function noop() {
//     }
//
//     function pingClients(type) {
//         switch (type) {
//             case "ingest":
//                 WsIngest.clients.forEach(function (ws) {
//                     if (ws.isAlive === false) return ws.terminate();
//                     ws.isAlive = false;
//                     ws.ping(noop);
//                 });
//                 break;
//             case "outgest":
//                 WsOutgest.clients.forEach(function (ws) {
//                     if (ws.isAlive === false) return ws.terminate();
//                     ws.isAlive = false;
//                     ws.ping(noop);
//                 });
//                 break;
//         }
//         timers[type] = setTimeout(pingClients, interval, type);
//     }
//
//     (function (that) {
//         for (let key in webSockets.wsServers) {
//             if (!webSockets.hasOwnProperty(key)) continue;
//             timers[key] = webSockets[key];
//         }
//     })(this);
// }

class VideoWebSocketServer extends WebSocket.Server {
    constructor(name, options = {noServer: true}) {
        super(options);

        const _this = this;

        this.name = name;

        this.pingInterval = 30000;
        this.pingTimer = null;

        this.on("connection", (socket, request) => {
            const socketId = request.headers["sec-websocket-key"];

            console.log(`[${name.toCamelCase()}-WebSocket] (${socketId}) connection: '${request.headers["origin"]}'`);

            _this._startPingTimer(socket);

            _this.onConnection(socket, request);
        });

        this.on('close', () => {
            console.log(`[${name.toCamelCase()}-WebSocket] closing`);
            if (_this.pingTimer) clearTimeout(_this.pingTimer);
            _this.onClose();
        });
    }

    onClose() {

    }

    onConnection(socket, request) {
        const socketId = request.headers["sec-websocket-key"];
        const name = this.name;
        socket.on('message', (message) => {
            console.log(`[${name.toCamelCase()}-WebSocket] (${socketId}) received: ${(message.length / 1024).toFixed(2)}kiB`);
        });

        socket.on('close', (code, reason) => {
            console.log(`[${name.toCamelCase()}-WebSocket] (${socketId}) close: ${reason} (${code})`);
        });

        socket.on('error', (error) => {
            console.error(`[${name.toCamelCase()}-WebSocket] (${socketId}) error: ` + JSON.stringify(error, null, 3));
        });
    }

    _startPingTimer(socket) {
        socket.isAlive = true;
        socket.on('pong', () => {
            socket.isAlive = true;
        });
        if (this.pingTimer === null) {
            this._pingClients();
        }
    }

    _pingClients() {
        //const name = this.name.toCamelCase();

        function noop() {
            //console.log(`[${name}-WebSocket] ping`);
        }

        function pingClients(_this) {
            _this.clients.forEach((ws) => {
                if (ws.isAlive === false) return ws.terminate();
                ws.isAlive = false;
                ws.ping(noop);
            });
            _this.pingTimer = setTimeout(pingClients, _this.pingInterval, _this);
        }

        this.pingTimer = setTimeout(pingClients, this.pingInterval, this);
    }
}

//class WebSockets {
//     constructor() {
//         const WsIngest = this.ingest = new VideoWebSocket("ingest", {noServer: true});
//         const WsFlvOutgest = this.flvoutgest = new VideoWebSocket("flvoutgest", {noServer: true});
//     }
//
//     onUpdgrade(request, socket, head) {
//         const pathname = Url.parse(request.url).pathname;
//         if (pathname === '/ingest') {
//             this.ingest.handleUpgrade(request, socket, head,
//                 (ws) => this.ingest.emit('connection', ws, request));
//         } else if (pathname === '/flvoutgest') {
//             this.flvoutgest.handleUpgrade(request, socket, head,
//                 (ws) => this.flvoutgest.emit('connection', ws, request));
//         } else {
//             socket.destroy();
//         }
//     }
// }

module.exports = VideoWebSocketServer;
