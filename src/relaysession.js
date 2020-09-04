const Net = require('net');
const FS = require('fs');
const Path = require('path');
const Perf = require('./performance.js');
const {NodeRtmpSession} = require('./rtmp/session');
const {FFmpegSession} = require("./ffmpeg/ffmpeg_session");
const {EventHandler, InternalEventHandler, Event, EventItem, EventsCache} = require("./event_handler");
const {RtmpRelayEvents, RtmpServerEvents, RtmpSessionEvents, FFmpegEvents} = require("./events");
const {ConsoleLogger, LogLevel} = require("./logger");
const Logger = new ConsoleLogger("RTMP_RELAY_SESSION");
const Helpers = require("./helpers");


function logRtmpEvent(evt, id, ...arr) {
    //Logger._log(LogLevel.Debug, "(" + id + ") " + evt + ": ", JSON.stringify(arr));
}

class RtmpRelaySession extends InternalEventHandler {
    /**
     * @param {PushServerInfo} pushServer
     * @returns {boolean}
     */
    pushStream(pushServer) {
        if (this.ffmpegSessions.hasOwnProperty(pushServer.id)) {
            return false;
        }
        if (this.rtmpSession.appInfo.name !== pushServer.name) {
            return false;
        }
        if (pushServer.autostart) {
            const ffmpeg = new FFmpegSession(
                "rtmp://localhost:" + this.config.rtmp.port + this.rtmpSession.publishStreamPath,
                this.rtmpSession.id, pushServer, this.config.ffmpeg.execPath, this.config.ffmpeg.logLevel);
            //TODO restart on error after timeout
            // stream failover video (RtmpSessionEvents.DonePublish or error?)

            ffmpeg.on(FFmpegEvents.Error, (event, ...data) => {
                // console.log(event, JSON.stringify(data, null, 3));
            });
            ffmpeg.on(FFmpegEvents.Close, (event, ...data) => {
                delete this.ffmpegSessions[ffmpeg.id];
                // console.log(event, JSON.stringify(data, null, 3));
            });

            this.ffmpegSessions[ffmpeg.id] = ffmpeg;

            return true;
        }
        return false;
    }

    // on(eventName, callback, once = false) {
    //     if (eventName.base === FFmpegEvents.CLASS_NAME) {
    //         this._ffmpegEvents[eventName.name] = new Event(eventName, callback, once);
    //     } else {
    //         return super.on(eventName, callback, once);
    //     }
    // }
    get appInfo() {
        return this.rtmpSession.appInfo;
    }

    get sessionInfo() {
        return this.rtmpSession.sessionInfo;
    }

    killFFmpeg(service_name = null) {
        for (let ffId in this.ffmpegSessions) {
            if (!this.ffmpegSessions.hasOwnProperty(ffId)) continue;
            if (typeof service_name === "string") {
                //TODO
                this.ffmpegSessions[ffId].kill();
            } else {
                this.ffmpegSessions[ffId].kill();
            }
        }
        this.ffmpegSessions = {};
    }

    stop() {
        this.killFFmpeg();
        this.ffmpegSessions = {};
        this.rtmpSession.stop();
    }

    constructor(socket, config) {
        super();
        this.config = config;
        const session = this.rtmpSession = new NodeRtmpSession({
            rtmp: config.rtmp,
            rtmpSession: config.rtmpSession
        }, socket);

        this.id = session.id;

        const ffSessions = this.ffmpegSessions = {};

        const _this = this;

        socket.on('close', function (data) {
            logRtmpEvent('closeSession', session.id, data);
            _this.killFFmpeg();

            session.stop();

            _this.emit(RtmpRelayEvents.Close, session.sessionInfo);
            EventHandler.emit(RtmpRelayEvents.Close, session.sessionInfo);
        });

        session.on(RtmpSessionEvents.PreConnect, (evt, id, cmdObj) => {
            logRtmpEvent(evt, id, cmdObj);
            let sessInfo = session.sessionInfo;
            _this.emit(RtmpRelayEvents.Auth, sessInfo);
            EventHandler.emit(RtmpSessionEvents.PreConnect, sessInfo);
            let res = EventHandler.emit(RtmpRelayEvents.Auth, sessInfo);
            if (res) {
                if (res.length > 0 && typeof res[0] === "boolean") return res[0];
                else return false;
            } else {
                console.warn("RtmpRelayEvents.Auth not implemented! using default 'allow all'");
                return true;
            }
        });

        session.on(RtmpSessionEvents.PostConnect, (evt, id, cmdObj) => {
            logRtmpEvent(evt, id, cmdObj);
            let sessInfo = session.sessionInfo;
            _this.emit(RtmpRelayEvents.Connect, sessInfo);
            EventHandler.emit(RtmpSessionEvents.PostConnect, sessInfo);
            return EventHandler.emit(RtmpRelayEvents.Connect, sessInfo);
        });

        session.on(RtmpSessionEvents.PrePlay, (evt, id, playStreamPath, playArgs) => {
            logRtmpEvent(evt, id, playStreamPath, playArgs);
            EventHandler.emit(RtmpSessionEvents.PrePlay, id, playStreamPath, playArgs);
        });

        session.on(RtmpSessionEvents.PostPlay, (evt, id, playStreamPath, playArgs) => {
            logRtmpEvent(evt, id, playStreamPath, playArgs);
            EventHandler.emit(RtmpSessionEvents.PostPlay, id, playStreamPath, playArgs);
        });

        session.on(RtmpSessionEvents.DonePlay, (evt, id, playStreamPath, playArgs) => {
            logRtmpEvent(evt, id, playStreamPath, playArgs);
            EventHandler.emit(RtmpSessionEvents.DonePlay, id, playStreamPath, playArgs);
        });

        session.on(RtmpSessionEvents.PrePublish, (evt, id, publishStreamPath, publishArgs) => {
            logRtmpEvent(evt, id, publishStreamPath, publishArgs);
            EventHandler.emit(RtmpSessionEvents.PrePublish, id, publishStreamPath, publishArgs);
        });

        session.on(RtmpSessionEvents.PostPublish, (evt, id, publishStreamPath, publishArgs) => {
            if (config.pushServers) {
                config.pushServers.forEach((server) => {
                    if (session.appInfo.name === server.name) {
                        setTimeout(() => {
                            _this.pushStream(server);
                        }, 1000);
                    }
                });
            }
            let sessInfo = session.sessionInfo;
            logRtmpEvent(evt, id, publishStreamPath, publishArgs);
            _this.emit(RtmpRelayEvents.Publish, sessInfo);
            return EventHandler.emit(RtmpRelayEvents.Publish, sessInfo);
        });

        session.on(RtmpSessionEvents.DonePublish, (evt, id, publishStreamPath, publishArgs) => {
            _this.killFFmpeg();

            logRtmpEvent(evt, id, publishStreamPath, publishArgs);
            let sessInfo = session.sessionInfo;
            _this.emit(RtmpRelayEvents.PublishEnd, sessInfo);
            EventHandler.emit(RtmpSessionEvents.DonePublish, sessInfo);
        });

        session.on(RtmpSessionEvents.DoneConnect, (evt, id, connectCmdObj) => {
            _this.killFFmpeg();

            logRtmpEvent(evt, id, connectCmdObj);
            let sessInfo = session.sessionInfo;
            _this.emit(RtmpRelayEvents.Disconnect, sessInfo);
            EventHandler.emit(RtmpSessionEvents.DoneConnect, sessInfo);
        });

        session.run();

        socket.setTimeout(30000);
    }
}

module.exports = {
    RtmpRelaySession: RtmpRelaySession,
    RtmpRelayEvents: RtmpRelayEvents
};
