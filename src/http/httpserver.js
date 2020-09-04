const Path = require("path");
const {ConsoleLogger, LogLevel} = require("../logger");
const Logger = new ConsoleLogger("HttpServer", LogLevel.Debug, false);

const Http = require('http');
const Express = require('express');
const bodyParser = require('body-parser');

const HttpRoutes = require("./httproutes");

const WsServer = require("./websocketroutes");

const HttpServerDefaultConfig = {
    port: 80,
    cors: ""
};

class HttpServer {
    constructor(config = HttpServerDefaultConfig) {
        if (!isNaN(parseInt(config))) {
            config = {...HttpServerDefaultConfig, port: config};
        }
        this.port = config.port;
        const app = this.expressApp = Express();

        app.use(bodyParser.urlencoded({extended: true}));

        if (typeof config.cors === "string" && config.cors.length > 0) {
            app.all('*', (req, res, next) => {
                //TODO set origin with config
                res.header("Access-Control-Allow-Origin", config.cors);
                res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With");
                res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
                res.header("Access-Control-Allow-Credentials", true);
                req.method === "OPTIONS" ? res.sendStatus(200) : next();
            });
        }

        HttpRoutes.Routes.forEach((route) => {
            app.use(route.path, route.router);
        });

        const server = this.httpServer = Http.createServer(app);

        server.on('upgrade', WsServer.onUpgrade);

        server.on('error', (e) => {
            Logger.error(`Http Server Error ${e}`);
        });

        server.on('close', () => {
            Logger.log('Http Server Close.');
        });
    }

    start() {
        const HTTP_PORT = this.port;
        this.httpServer.listen(HTTP_PORT, () => {
            Logger.log(`Http Server started on port: ${HTTP_PORT}`);
        });
    }

    stop() {
        this.httpServer.close((e) => {
            Logger.error(`Http Server Closed ${e}`);
        })
    }
}

module.exports = HttpServer;
