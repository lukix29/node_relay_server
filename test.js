
const Path = require('path');
const FS = require("fs");
const {
    RtmpRelayServer,
    RtmpAllowType,

    RtmpServerEvents,
    RtmpRelayEvents,
    FFmpegEvents,
    RtmpSessionEvents,

    ConsoleLogger,
    LogLevel,

    RtmpRelaySession,
    FFmpegSession,
    DefaultConfig
} = require('./src/relayserver');//TODO FOR TEST WITH build REPLACE ./src/relayserver WITH ./build/RtmpRelayServer
const HttpServer = require("./src/http/httpserver");//TODO FOR TEST WITH build REPLACE ./src/relayserver WITH ./build/RtmpRelayServer

const TWITCH_INGEST_LUKIX29 = "rtmp://live-vie.twitch.tv/app/live_79328905_SVOMbujOFBA3y60cY8MC8dEhssvLnA?bandwidthtest=true";
const TROVO_INGEST_LUKIX29 = "rtmp://livepush.trovo.live/live/73846_100168278_100168278?bizid=73846&txSecret=60a490d18a7700c0fa4e6d2a4450731d&txTime=6122f163&cert=9927bdb29091807f61069b25535d2b01&certTime=5f41bde3&flag=txcloud_100168278_100168278&timeshift_bps=0%7C600%7C1500%7C2500%7C5000%7C8000&timeshift_dur=43200&tp_code=1598143971&tp_sign=2025332970&dm_sign=173005253&pq_sn=1609186031";
const YOUTUBE_INGEST_LUKIX29 = "rtmp://a.rtmp.youtube.com/live2";

const Logger = new ConsoleLogger("MAIN", LogLevel.Debug, false);

const rtmpRelayServer = new RtmpRelayServer({
    ffmpeg: {
        logLevel: LogLevel.Verbose,
    },
    rtmp: {
        logLevel: LogLevel.Error,
    },
    rtmpSession: {
        logLevel: LogLevel.Debug,
        infoInterval: false,
        allowPush: RtmpAllowType.All,
        allowPull: RtmpAllowType.All,
    },
    pushServers: {
        /*app name*/lukix29: {
            twitch: {
                url: [TWITCH_INGEST_LUKIX29],
                autostart: true
            },
            trovo: {
                url: [TROVO_INGEST_LUKIX29],
                autostart: true
            },
            youtube: {
                url: [YOUTUBE_INGEST_LUKIX29],
                autostart: true
            }
        }
    }
});

const httpServer = new HttpServer(80);

const doLOG = false;
//RtmpServerEvents

rtmpRelayServer.on(RtmpServerEvents.Started, (event, ...args) => {
    if (doLOG) Logger.log(`RtmpServer (${event}):`, ...args);
});

rtmpRelayServer.on(RtmpServerEvents.Close, (event, ...args) => {
    if (doLOG) Logger.log(`RtmpServer (${event}):`, ...args);
});

rtmpRelayServer.on(RtmpServerEvents.Error, (event, ...args) => {
    if (doLOG) Logger.error(`RtmpServer (${event}):`, ...args);
});

rtmpRelayServer.on(RtmpServerEvents.Connection, (event, ...args) => {
    if (doLOG) Logger.log(`RtmpServer (${event}):`, ...args);
});

rtmpRelayServer.on(RtmpServerEvents.Info, (event, ...args) => {
    if (doLOG) Logger.log(`RtmpServer (${event}):`, ...args);
});

//RtmpRelayEvents
rtmpRelayServer.on(RtmpRelayEvents.Auth, (event, ...args) => {
    if (doLOG) Logger.log(`RtmpRelay (${event}):`, ...args);
    //True = Authed
    return true;
    //False = Reject Connection
    //return false;
});

rtmpRelayServer.on(RtmpRelayEvents.Connect, (event, ...args) => {
    if (doLOG) Logger.log(`RtmpRelay (${event}):`, ...args);
});

rtmpRelayServer.on(RtmpRelayEvents.Publish, (event, ...args) => {
    if (doLOG) Logger.log(`RtmpRelay (${event}):`, ...args);
});

rtmpRelayServer.on(RtmpRelayEvents.Close, (event, ...args) => {
    if (doLOG) Logger.log(`RtmpRelay (${event}):`, ...args);
});

rtmpRelayServer.on(RtmpRelayEvents.Error, (event, ...args) => {
    if (doLOG) Logger.error(`RtmpRelay (${event}):`, ...args);
});

/*

RtmpServerEvents.AllEvents.forEach((eventName) => {
    rtmpRelayServer.on(eventName, (event, ...args) => {
        if (doLOG) Logger.log(`RtmpServer (${event}):`, ...args);
    });
});

RtmpRelayEvents.AllEvents.forEach((eventName) => {
    rtmpRelayServer.on(eventName, (event, ...args) => {
        if (doLOG) Logger.log(`RtmpRelay (${event}):`, ...args);
    });
});

FFmpegEvents.AllEvents.forEach((eventName) => {
    rtmpRelayServer.on(eventName, (event, ...args) => {
        if (doLOG) Logger.log(`FFmpeg (${event}):`, ...args);
    });
});

RtmpSessionEvents.AllEvents.forEach((eventName) => {
    rtmpRelayServer.on(eventName, (event, ...args) => {
        if (doLOG) Logger.log(`RtmpSession (${event}):`, ...args);
    });
});

// setInterval(function () {
//    // console.log(rtmpRelayServer.stats);
//     // if (rtmpRelayServer.sessions.length > 0) {
//     //  console.log(Helpers.hash(rtmpRelayServer.sessions[0].sessionInfo));
//     // }
// }, 1000);
*/

rtmpRelayServer.start();

httpServer.start();
