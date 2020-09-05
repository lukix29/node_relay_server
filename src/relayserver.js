const Net = require('net');
const {FFmpegSession, PushServerInfo} = require("./ffmpeg/ffmpeg_session");
const {EventHandler, Event, EventItem, EventsCache} = require("./event_handler");
const {RtmpRelayEvents, RtmpServerEvents, RtmpSessionEvents, FFmpegEvents} = require("./events");
const {RtmpRelaySession} = require("./relaysession");
const {ConsoleLogger, LogLevel} = require("./logger");
const Logger = new ConsoleLogger("RTMP_SERVER");
const Helpers = require("./helpers");

class RtmpAllowType {
    static get All() {
        return new RtmpAllowType(["*", "all", "0.0.0.0"]);
    }

    static get Local() {
        return new RtmpAllowType(["local", "localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1"]);
    }

    check(ip) {
        if (this.names.includes("all")) {
            return true;
        }
        return this.names.includes(ip.trim().toLowerCase());
    }

    /**
     * @param {[string],string} aliases
     */
    constructor(aliases) {
        this.names = (typeof aliases === "string") ? [aliases] : aliases;
    }
}

const DEFAULT_CONFIG = {
    ffmpeg: {
        //logLevel: LogLevel.Debug,
        execPath: "ffmpeg",
        args: [],
        respawnTimeout: 5,//false
    },
    rtmp: {
        logLevel: LogLevel.Error,
        port: 1935,
        chunk_size: 4096,
        gop_cache: true,
        ping: 30,
        ping_timeout: 30
    },
    rtmpSession: {
        logLevel: LogLevel.Error,
        infoInterval: 5,//false
        allowPush: RtmpAllowType.All,
        allowPull: RtmpAllowType.All,
    },
    pushServers: {}
};

function checkConfig(config = DEFAULT_CONFIG) {
    if (config.hasOwnProperty("rtmp")) {
        config.rtmp = {...DEFAULT_CONFIG.rtmp, ...config.rtmp};
    } else {
        config.rtmp = {...DEFAULT_CONFIG.rtmp};
    }
    if (config.hasOwnProperty("rtmpSession")) {
        config.rtmpSession = {...DEFAULT_CONFIG.rtmpSession, ...config.rtmpSession};
    } else {
        config.rtmpSession = {...DEFAULT_CONFIG.rtmpSession};
    }
    config.rtmpSession.infoInterval = Helpers.checkTimeoutArg(config.rtmpSession.infoInterval);

    if (config.hasOwnProperty("ffmpeg")) {
        config.ffmpeg = {...DEFAULT_CONFIG.ffmpeg, ...config.ffmpeg};
    } else {
        config.ffmpeg = {...DEFAULT_CONFIG.ffmpeg};
    }
    config.ffmpeg.respawnTimeout = Helpers.checkTimeoutArg(config.ffmpeg.respawnTimeout);

    if (config.hasOwnProperty("pushServers")) {
        let servers = {...config.pushServers};
        config.pushServers = [];
        for (let appname in servers) {
            if (!servers.hasOwnProperty(appname)) continue;
            for (let serviceName in servers[appname]) {
                if (!servers[appname].hasOwnProperty(serviceName)) continue;
                config.pushServers.push(new PushServerInfo(appname, serviceName,
                    servers[appname][serviceName].url,
                    servers[appname][serviceName].autostart,
                    servers[appname][serviceName].ffmpegArgs,
                    servers[appname][serviceName].logLevel));
            }
        }
    }
    return config;
}

class RtmpRelaySessionMap extends Map {
    constructor() {
        super();
    }

    add(key, value) {
        super.set(key, value);
    }

    get length() {
        return super.size;
    }

    get stats() {
        let stats = {};
        this.forEach((session) => {
            stats[session.id] = session.sessionInfo;
        });
        return stats;
    }

    empty() {
        this.forEach((session) => {
            try {
                session.stop();
            } catch (e) {

            }
        });
        super.clear();
    }

    remove(key) {
        super.delete(key);
    }

    forEach(callbackfn) {
        super.forEach(callbackfn);
    }

    get(key) {
        return super.get(key);
    }

    hasKey(key) {
        return super.has(key);
    }

    get keys() {
        return Array.from(super.keys());
    }

    get values() {
        return Array.from(super.values());
    }

    toArray() {
        return Array.from(this.entries()).map((t) => {
            return {[t[0]]: t[1]}
        });
    }
}

class RtmpRelayServer {
    on(event, callback, once = false) {
        EventHandler.on(event, callback, once);
    }

    once(event, callback) {
        EventHandler.once(event, callback);
    }

    off(event, index = -1) {
        EventHandler.off(event, index);
    }

    get sessions() {
        return this._sessions.values;
    }

    get stats() {
        return this._sessions.stats;
    }

    start() {
        if (this._tcpserver) {
            throw new Error("Server already running!");
        }
        const _this = this;

        this._tcpserver = Net.createServer();

        this._tcpserver.listen(this.config.rtmp.port, () => {
            Logger.log(`Rtmp Server started on port: ${this.config.rtmp.port}`);
            EventHandler.emit(RtmpServerEvents.Started, this.config.rtmp.port);
        });

        this._tcpserver.on("connection", (socket) => {
            let rtmpReplaySession = new RtmpRelaySession(socket, _this.config);

            _this._sessions.set(rtmpReplaySession.id, rtmpReplaySession);

            rtmpReplaySession.once(RtmpRelayEvents.Connect, (event, sessionInfo) => {
                //console.log(sessionInfo);
            });

            rtmpReplaySession.once(RtmpRelayEvents.Close, (event, sessionInfo) => {
                _this._sessions.remove(sessionInfo.id);
            });

            this._setInfoTimer(_this);

            EventHandler.emit(RtmpServerEvents.Connection, socket, rtmpReplaySession);
        });

        this._tcpserver.on('error', (e) => {
            _this._sessions.empty();
            Logger.error(`Rtmp Server Error ${e}`);
            EventHandler.emit(RtmpServerEvents.Error, e);
        });

        this._tcpserver.on('close', (status) => {
            _this._sessions.empty();
            Logger.log('Rtmp Server Close.');
            EventHandler.emit(RtmpServerEvents.Close, status);
        });
    }

    /**
     * @param {string} app_name
     * @param {string} stream_service
     * @param {string,Array} urls
     * @param {Array} ffmpegArgs
     * @param {LogLevel} logLevel
     */
    addPushServer(app_name, stream_service, urls, autostart = false, ffmpegArgs = [], logLevel = LogLevel.Verbose) {
        if (!this.config.pushServers.hasOwnProperty(app_name + "_" + stream_service)) {
            const psi = new PushServerInfo(app_name, stream_service, url, autostart, ffmpegArgs, logLevel);
            this.config.pushServers[psi.id] = psi;

            if (autostart) {
                this._sessions.forEach((session) => {
                    if (session.appInfo.name === app_name) {
                        session.pushStream(psi);
                    }
                });
            }
            return true;
        }
        return false;
    }

    removePushServer(app_name, stream_service, stop = true) {
        let idx = this.config.pushServers.findIndex((server) => (server.name === app_name && server.service === stream_service));
        if (idx >= 0) {
            if (stop == true) {
                let pushS = this.config.pushServers[idx];
                this._sessions.forEach((session) => {
                    if (session.ffmpegSessions.hasOwnProperty(pushS.id)) {
                        session.ffmpegSessions[pushS.id].kill();
                    }
                });
            }
            return this.config.pushServers.splice(idx, 1)[0];
        }
        return false;
    }

    constructor(config = DEFAULT_CONFIG) {
        config = this.config = checkConfig(config);
        this._lastHash = "";

        this._tcpserver = null;
        this._infoTimer = null;

        this._sessions = new RtmpRelaySessionMap();

        /**
         * @param {RtmpRelayServer} _this
         */
        this._setInfoTimer = function (_this) {
            if (_this._infoTimer) clearTimeout(_this._infoTimer);
            if (_this._sessions.length === 0 || config.rtmpSession.infoInterval === 0) {
                return;
            }
            if (EventHandler.has(RtmpServerEvents.Info)) {
                let stats = _this._sessions.stats;
                let hash = Helpers.hash(stats);
                if (hash !== _this._lastHash) {
                    EventHandler.emit(RtmpServerEvents.Info, stats);
                }
                _this._lastHash = hash;
            }
            _this._infoTimer = setTimeout(_this._setInfoTimer, Math.max(1000, config.rtmpSession.infoInterval), _this);
        };

        Logger.level = config.rtmp.logLevel || LogLevel.Error;
    }
}

module.exports = {
    RtmpServerEvents: RtmpServerEvents,
    RtmpSessionEvents: RtmpSessionEvents,
    FFmpegEvents: FFmpegEvents,
    RtmpRelayEvents: RtmpRelayEvents,

    FFmpegSession: FFmpegSession,
    RtmpRelaySession: RtmpRelaySession,

    ConsoleLogger: ConsoleLogger,
    LogLevel: LogLevel,

    RtmpRelayServer: RtmpRelayServer,
    RtmpAllowType: RtmpAllowType,

    DefaultConfig: DEFAULT_CONFIG,

    HttpServer: require("./http/httpserver"),
};
