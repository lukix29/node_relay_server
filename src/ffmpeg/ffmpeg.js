const Perf = require('../performance.js');
const Net = require('net');
const FS = require('fs');
const Path = require('path');
const {spawn} = require('child_process');
const NodeCoreUtils = require("../rtmp/core_utils");
const {EventHandler, InternalEventHandler, Event, EventItem, EventsCache} = require("../event_handler");
const {RtmpRelayEvents, RtmpServerEvents, RtmpSessionEvents, FFmpegEvents} = require("../events");
const {FFmpegSession, PushServerInfo} = require("./ffmpeg_session");
const {FFmpegArgs, FFmpegDefaultArguments} = require("./ffmpeg_args");
const {ConsoleLogger, LogLevel} = require("../logger");
const Helpers = require("../helpers");
const Logger = new ConsoleLogger("FFMPEG");

class FFmpeg extends InternalEventHandler {
    kill() {
        if (this.ffmpeg_proc) {
            this.ffmpeg_proc.kill("SIGTERM");
            Logger.verbose("(" + this.id + ") killing: [" + this.streamId + "]", {
                streamId: this.streamId,
                ffmpegId: this.id
            });
        }
    }

    get id() {
        return this.ffmpeg_proc.pid || -1;
    }

    get info() {
        return {
            processId: this.ffmpeg_proc.pid || -1,
            exitCode: this.ffmpeg_proc.exitCode || -1,
            input: this.input,
            output: this.output,
            args: this.args.argString,
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

    get process() {
        return this.ffmpeg_proc;
    }

    write(buffer) {
        if (this.ffmpeg_proc) {
            if (this.ffmpeg_proc.stdin) {
                if (!this.ffmpeg_proc.stdin.destroyed) {
                    this.ffmpeg_proc.stdin.write(buffer);
                }
            }
        }
    }

    /**
     * @returns {NodeJS.ReadStream}
     */
    get stdin() {

        /*  write(chunk: any, cb?: (error: Error | null | undefined) => void): boolean;
            write(chunk: any, encoding: BufferEncoding, cb?: (error: Error | null | undefined) => void): boolean;
            * Events
            * 1. close
            * 2. drain
            * 3. error
            * 4. finish
            * 5. pipe
            * 6. unpipe */

        return this.ffmpeg_proc.stdin;
    }

    get stdout() {
        return this.ffmpeg_proc.stdout;
    }

    get stderr() {
        return this.ffmpeg_proc.stderr;
    }

    addProcessEvent(eventName, callback, once = false) {
        if (once === true) this.ffmpeg_proc.once(eventName, callback);
        else this.ffmpeg_proc.on(eventName, callback);
    }

    addStdOutEvent(eventName, callback, once = false) {
        if (once === true) this.ffmpeg_proc.stdout.once(eventName, callback);
        else this.ffmpeg_proc.stdout.on(eventName, callback);
    }

    addStdErrEvent(eventName, callback, once = false) {
        if (once === true) this.ffmpeg_proc.stderr.once(eventName, callback);
        else this.ffmpeg_proc.stderr.on(eventName, callback);
    }

    start(args = null) {
        if (args) {
            if (!(args instanceof FFmpegArgs) && Array.isArray(args) && args.length > 0) {
                this.args = new FFmpegArgs(args);
            } else {
                this.args = args;
            }
        }

        const _this = this;

        const ffargs = this.args.args;
        this.ffmpeg_proc = spawn(this.execPath, ffargs);

        Logger.verbose("(" + _this.id + ") starting: [" + _this.streamId + "]", {
            input: this.input,
            output: this.output,
            args: ffargs
        });

        _this.emit(FFmpegEvents.Starting, {ffmpegId: this.id, streamId: this.streamId});

        let lastErrors = [];
        let hasStarted = false;
        this.ffmpeg_proc.on('error', (e) => {
            _this.emit(FFmpegEvents.Error, {error: e});
            Logger.error("(" + _this.id + ") error: [" + _this.streamId + "]", e);
        });

        /*this.ffmpeg_proc.stdout.on('data', (data) => {
            let d = {info: _this.info, data: data.toString()};
            _this.emit(FFmpegEvents.Stdout, d);
            Logger.debug("(" + _this.id + ") stdout: [" + _this.streamId + "]", data);
        });*/

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
            if (code > 0) {
                let errLines = lastErrors.filter((t) => t.indexOf("error") >= 0 || t.indexOf("failed") >= 0);

                let errorData = {error: {exitCode: code, message: errLines, info: _this.info}};
                _this.emit(FFmpegEvents.Error, errorData);
                Logger.error("(" + _this.id + ") error: [" + _this.streamId + "]", errorData);
            }
            _this.emit(FFmpegEvents.Close, {info: _this.info, code: code});

            if (code > 0) Logger.error("(" + _this.id + ") close: [" + _this.streamId + "]", {exitCode: code});
            else Logger.verbose("(" + _this.id + ") close: [" + _this.streamId + "]", code);
        });
    }

    /**
     * @param {FFmpegArgs|[{}]} args
     * @param {string} execPath
     * @param {LogLevel} logLevel
     */
    constructor(args = null, logLevel = null, execPath = "ffmpeg") {
        super();
        this.execPath = execPath;
        this.stats = {};
        this.ffmpeg_proc = null;

        if (Array.isArray(args) || args instanceof FFmpegArgs) {
            Logger.level = logLevel || LogLevel.Verbose;
            if (!(args instanceof FFmpegArgs) && Array.isArray(args) && args.length > 0) {
                this.args = new FFmpegArgs(args);
            } else {
                this.args = args;
            }
        } else if (args instanceof LogLevel) {
            Logger.level = args || LogLevel.Verbose;
        } else {
            Logger.level = LogLevel.Verbose;
        }
    }
}

module.exports = FFmpeg;
