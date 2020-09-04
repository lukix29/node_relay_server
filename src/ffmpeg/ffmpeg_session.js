const Perf = require('../performance.js');
const Net = require('net');
const FS = require('fs');
const Path = require('path');
const {spawn} = require('child_process');
const NodeCoreUtils = require("../rtmp/core_utils");
const {EventHandler, InternalEventHandler, Event, EventItem, EventsCache} = require("../event_handler");
const {RtmpRelayEvents, RtmpServerEvents, RtmpSessionEvents, FFmpegEvents} = require("../events");
const {FFmpegArgs, FFmpegDefaultArguments} = require("./ffmpeg_args");
const {ConsoleLogger, LogLevel} = require("../logger");
const Helpers = require("../helpers");
const Logger = new ConsoleLogger("FFMPEG");

const ffmpegIds = new Map();

class PushServerInfo {
    /**
     * @param {string} app_name
     * @param {string} stream_service
     * @param {string,Array,Object} urls/pushServiceInfo
     * @param {boolean} autoStart
     * @param {FFmpegArgs,Array} ffmpegArgs
     * @param {LogLevel} logLevel
     */
    constructor(app_name, stream_service, urls, autoStart = false, ffmpegArgs = [], logLevel = null) {
        this.name = app_name;
        this.service = stream_service;

        if (urls.hasOwnProperty("url")) {
            this.urls = (Array.isArray(urls.urls) ? urls.urls : [urls.urls]);
            this.autostart = urls.autostart || autoStart;
            this.ffmpegArgs = urls.ffmpegArgs || ffmpegArgs;
            this.logLevel = urls.logLevel || logLevel;
        } else {
            this.urls = (Array.isArray(urls) ? urls : [urls]);
            this.autostart = autoStart;
            this.ffmpegArgs = ffmpegArgs;
            this.logLevel = logLevel;
        }
    }

    get id() {
        return this.name + "_" + this.service;
    }
}

/*
const DefaultFFmpegArgs = {
    execPath: "ffmpeg",
    streamId: "",
    input: "",
    output: [""],
    args: [],
    logLevel: LogLevel.Verbose,
};

const DefaultPublishServer = [{
    app_name: {
        stream_service: {
            url: [""],
            ffmpegArgs: []
        }
    }
}];

function DefaultArgs(input = "[INPUT]", output = ["[OUTPUT]"]) {
    return [
        "-hide_banner",
        "-y",
        //"-re",
        "-i", input,
        "-c:v", "copy",
        "-c:a", "copy",
        "-f", "tee",
        "-map", "0:v?",
        "-map", "0:a?",
        "-map", "0:s?",
        "'" + "[f=flv]" + output.join("|[f=flv]") + "'"
    ];
}

const FFmpegEvents = {
    Starting: "starting",
    Started: "started",
    Error: "error",
    Stdout: "stdout",
    Stderr: "stderr",
    Close: "close",
};*/

class FFmpegSession extends InternalEventHandler {
    get logLevel() {
        return Logger.level;
    }

    kill() {
        this.ffmpeg_proc.kill("SIGTERM");
        Logger.verbose("(" + this.id + ") killing: [" + this.streamId + "]", {
            streamId: this.streamId,
            ffmpegId: this.id
        });
    }

    get info() {
        return {
            ffmpegId: this.id,
            streamId: this.streamId,
            processId: this.ffmpeg_proc.pid,
            exitCode: this.ffmpeg_proc.exitCode,
            input: this.config.input,
            output: this.config.urls,
            args: this.arguments,
            stats: this.stats
        }
    }

    _parseFFmpegInfo(input) {
        input = input.trim();
        if (input.indexOf("frame") === 0) {
            const FfmpegStatsRegex = /((\w+)=(?:\s*)([a-zA-Z0-9\.\/\-:]+)(?:\s+))/gmi;
            let matches;
            while ((matches = FfmpegStatsRegex.exec(input)) !== null) {
                if (matches.index === FfmpegStatsRegex.lastIndex) FfmpegStatsRegex.lastIndex++;
                if (matches.length >= 4) this.stats[matches[2]] = matches[3];
            }
        }
    }

    emit(event, ...data) {
        super.emit(event, ...data);
        EventHandler.emit(event, ...data);
        if (event.name === "error") {
            EventHandler.emit(event, ...data);
        }
    }

    /**
     * @param {string} inputUrl
     * @param {string} streamId
     * @param {PushServerInfo} options
     * @param {string} execPath
     */
    constructor(inputUrl, streamId, options, execPath = "ffmpeg", logLevel = null) {
        super();
        const _this = this;
        options.input = inputUrl;
        this.config = options;

        //console.log(options.logLevel + " | " + logLevel);

        this.config.logLevel = Logger.level = options.logLevel || logLevel || LogLevel.Verbose;

        this.stats = {};
        if (!(options.ffmpegArgs instanceof FFmpegArgs) && Array.isArray(options.ffmpegArgs) && options.ffmpegArgs.length > 0) {
            options.ffmpegArgs = new FFmpegArgs(options.ffmpegArgs);
        } else {
            options.ffmpegArgs = FFmpegArgs.getDefault(inputUrl, options.urls);
        }

        this.arguments = options.ffmpegArgs;
        const ffargs = this.arguments.args;

        this.streamId = streamId;
        this.id = options.id;// NodeCoreUtils.genRandomID(ffmpegIds);
        ffmpegIds.set(this.id, this);

        let lastErrors = [];
        let hasStarted = false;

        this.ffmpeg_proc = spawn(execPath, ffargs);

        Logger.verbose("(" + _this.id + ") starting: [" + _this.streamId + "]", {
            input: inputUrl,
            output: options.urls,
            args: ffargs
        });

        _this.emit(FFmpegEvents.Starting, {ffmpegId: this.id, streamId: this.streamId});

        this.ffmpeg_proc.on('error', (e) => {
            _this.emit(FFmpegEvents.Error, {error: e});
            Logger.error("(" + _this.id + ") error: [" + _this.streamId + "]", e);
        });

        this.ffmpeg_proc.stdout.on('data', (data) => {
            let d = {info: _this.info, data: data.toString()};
            _this.emit(FFmpegEvents.Stdout, d);
            Logger.debug("(" + _this.id + ") stdout: [" + _this.streamId + "]", data);
        });

        this.ffmpeg_proc.stderr.on('data', (data) => {
            data = data.toString().replace(/[ ]+/gmi, " ").trim();

            lastErrors.push(...Helpers.getLines(data));
            if (lastErrors.length > 10) {
                lastErrors.splice(0, lastErrors.length - 10);
            }

            if (!hasStarted) {
                hasStarted = true;
                Logger.verbose("(" + _this.id + ") started: [" + _this.streamId + "]", _this.info);
                _this.emit(FFmpegEvents.Started, {info: _this.info, data: data});
            }
            _this._parseFFmpegInfo(data);
            _this.emit(FFmpegEvents.Stderr, {info: _this.info, data: data});
            Logger.debug("(" + _this.id + ") stderr: [" + _this.streamId + "]", data);
        });

        this.ffmpeg_proc.on('close', (code) => {
            ffmpegIds.delete(_this.id);
            if (code > 0) {
                let errLines = lastErrors.filter((t) => t.indexOf("error") >= 0 || t.indexOf("failed") >= 0);

                let errorData = {error: {exitCode: code, message: errLines/*.join("\n")*/, ffmpegConfig: options}};
                _this.emit(FFmpegEvents.Error, errorData);
                Logger.error("(" + _this.id + ") error: [" + _this.streamId + "]", errorData);
            }
            _this.emit(FFmpegEvents.Close, {info: _this.info, code: code});

            if (code > 0) Logger.error("(" + _this.id + ") close: [" + _this.streamId + "]", {exitCode: code});
            else Logger.verbose("(" + _this.id + ") close: [" + _this.streamId + "]", code);
        });
    }
}

module.exports = {
    FFmpegSession: FFmpegSession,
    FFmpegEvents: FFmpegEvents,
    PushServerInfo: PushServerInfo
};
