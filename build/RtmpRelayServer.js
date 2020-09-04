'use strict';

Object.defineProperty(exports, '__esModule', {value: true});

var net = require('net');
require('fs');
require('path');
var child_process = require('child_process');
var crypto = require('crypto');
var events$1 = require('events');
require('readline');
var querystring = require('querystring');
var url$1 = require('url');

function _interopDefaultLegacy(e) {
    return e && typeof e === 'object' && 'default' in e ? e : {'default': e};
}

var net__default = /*#__PURE__*/_interopDefaultLegacy(net);
var child_process__default = /*#__PURE__*/_interopDefaultLegacy(child_process);
var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);
var events__default = /*#__PURE__*/_interopDefaultLegacy(events$1);
var querystring__default = /*#__PURE__*/_interopDefaultLegacy(querystring);
var url__default = /*#__PURE__*/_interopDefaultLegacy(url$1);

const __perf_base_time = Math.floor(process.hrtime()[0]);

class RtmpMap extends Map {
    constructor() {
        super();
    }

    getName(name) {
        let pub = null;
        this.forEach((publisher, key) => {
            if (key.indexOf(name) >= 0) {
                pub = publisher;
            }
        });
        return pub;
    }

    hasName(name) {
        let isFind = false;
        this.forEach((publisher, key) => {
            if (key.indexOf(name) >= 0) {
                isFind = true;
            }
        });
        return isFind;
    }
}

let sessions = new Map();
let publishers = new RtmpMap();
let idlePlayers = new Set();
let nodeEvent = new events__default['default']();
let stat = {
    inbytes: 0,
    outbytes: 0,
    accepted: 0
};
var core_ctx = {sessions, publishers, idlePlayers, nodeEvent, stat};

const {spawn} = child_process__default['default'];

function generateNewSessionID() {
    let sessionID = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWKYZ0123456789';
    const numPossible = possible.length;
    do {
        for (let i = 0; i < 8; i++) {
            sessionID += possible.charAt((Math.random() * numPossible) | 0);
        }
    } while (core_ctx.sessions.has(sessionID));
    return sessionID;
}

function genRandomID(mapToCheck = new Map()) {
    let name = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWKYZ0123456789';
    const numPossible = possible.length;
    do {
        for (let i = 0; i < 8; i++) {
            name += possible.charAt((Math.random() * numPossible) | 0);
        }
    } while (mapToCheck.has(name));
    return name;
}

function genRandomName() {
    let name = '';
    const possible = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const numPossible = possible.length;
    for (let i = 0; i < 4; i++) {
        name += possible.charAt((Math.random() * numPossible) | 0);
    }
    return name;
}

function verifyAuth(signStr, streamId, secretKey) {
    if (signStr === undefined) {
        return false;
    }
    let now = Date.now() / 1000 | 0;
    let exp = parseInt(signStr.split('-')[0]);
    let shv = signStr.split('-')[1];
    let str = streamId + '-' + exp + '-' + secretKey;
    if (exp < now) {
        return false;
    }
    let md5 = crypto__default['default'].createHash('md5');
    let ohv = md5.update(str).digest('hex');
    return shv === ohv;
}

function getFFmpegVersion(ffpath) {
    return new Promise((resolve, reject) => {
        let ffmpeg_exec = spawn(ffpath, ['-version']);
        let version = '';
        ffmpeg_exec.on('error', (e) => {
            reject(e);
        });
        ffmpeg_exec.stdout.on('data', (data) => {
            try {
                version = data.toString().split(/(?:\r\n|\r|\n)/g)[0].split('\ ')[2];
            } catch (e) {
            }
        });
        ffmpeg_exec.on('close', (code) => {
            resolve(version);
        });
    });
}

function getFFmpegUrl() {
    let url = '';
    switch (process.platform) {
        case 'darwin':
            url = 'https://ffmpeg.zeranoe.com/builds/macos64/static/ffmpeg-latest-macos64-static.zip';
            break;
        case 'win32':
            url = 'https://ffmpeg.zeranoe.com/builds/win64/static/ffmpeg-latest-win64-static.zip | https://ffmpeg.zeranoe.com/builds/win32/static/ffmpeg-latest-win32-static.zip';
            break;
        case 'linux':
            url = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-64bit-static.tar.xz | https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-32bit-static.tar.xz';
            break;
        default:
            url = 'http://ffmpeg.org/download.html';
            break;
    }
    return url;
}

var core_utils = {
    generateNewSessionID,
    genRandomID,
    verifyAuth,
    genRandomName,
    getFFmpegVersion,
    getFFmpegUrl
};

const EventsCache = {};

function addToCache(eventItem, callback, once) {
    if (!EventsCache.hasOwnProperty(eventItem.base))
        EventsCache[eventItem.base] = {};
    if (!EventsCache[eventItem.base].hasOwnProperty(eventItem.name))
        EventsCache[eventItem.base][eventItem.name] = [];
    let event = new Event(eventItem.name, eventItem.base, callback, once);
    EventsCache[eventItem.base][eventItem.name].push(event);
    return event;
}

class EventItem {
    get base() {
        return this._baseName;
    }

    get name() {
        return this._name;
    }

    constructor(name, baseName) {
        if (name instanceof EventItem) {
            name = name.name;
            baseName = name.base;
        } else if (typeof name !== "string") {
            name = name.toString();
        }
        this._name = name;
        this._baseName = baseName;
    }

    toString() {
        return `{${this._baseName}: ${this._name}}`;
    }
}

class Event extends EventItem {
    get once() {
        return this._once;
    }

    constructor(name, baseName, callback, once = false) {
        super(name, baseName);
        this._callback = callback;
        this._once = once === true;
    }

    callback(...args) {
        return this._callback(this._name, ...args);
    }
}

class InternalEventHandler {
    get events() {
        return this._events;
    }

    emit(eventName, ...data) {
        if (typeof eventName === "string") {
            eventName = new EventItem(eventName);
        }
        let name = eventName.name;
        let base = eventName.base;
        if (this._events.hasOwnProperty(base) && this._events[base].hasOwnProperty(name)) {
            let results = [];
            this._events[base][name].forEach((event, index) => {
                if (event) {
                    results.push(event.callback(...data));
                    if (event.once) {
                        this._events[base][name][index] = null;
                    }
                }
            });
            return results;
        }
        return null;
    }

    on(eventItem, callback, once = false) {
        if (eventItem instanceof EventItem) {
            if (!this._events.hasOwnProperty(eventItem.base))
                this._events[eventItem.base] = {};
            if (!this._events[eventItem.base].hasOwnProperty(eventItem.name))
                this._events[eventItem.base][eventItem.name] = [];
            let event = new Event(eventItem.name, eventItem.base, callback, once);
            this._events[eventItem.base][eventItem.name].push(event);
            return this._events[eventItem.base][eventItem.name].length - 1;
        }
        throw new Error("eventName must be of type EventItem");
    }

    once(eventName, callback) {
        return this.on(eventName, callback, true);
    }

    off(event, index = -1) {
        if (index < 0) {
            return delete this._events[event.base][event.name];
        } else {
            return delete this._events[event.base][event.name][index];
        }
    }

    constructor() {
        this._events = {};
    }
}

class GlobalEventHandler {
    static get events() {
        return EventsCache;
    }

    static has(eventName) {
        let name = eventName.name;
        let base = eventName.base;
        if (EventsCache.hasOwnProperty(base)) {
            if (EventsCache[base].hasOwnProperty(name)) {
                return EventsCache[base][name].length > 0;
            }
        }
        return false;
    }

    static emit(eventName, ...data) {
        let name = eventName.name;
        let base = eventName.base;
        if (EventsCache.hasOwnProperty(base)) {
            if (EventsCache[base].hasOwnProperty(name)) {
                let results = [];
                EventsCache[base][name].forEach((event, index) => {
                    if (event) {
                        results.push(event.callback(...data));
                        if (event.once) {
                            EventsCache[base][name][index] = null;
                        }
                    }
                });
                return results;
            }
        }
        return null;
    }

    static on(event, callback, once = false) {
        if (event instanceof EventItem) {
            addToCache(event, callback, once);
            return true;
        }
        throw new Error("eventName must be of type EventItem");
    }

    static once(eventName, callback) {
        return this.on(eventName, callback, true);
    }

    static off(event, index = -1) {
        if (index < 0) {
            return delete EventsCache[event.base][event.name];
        } else {
            return delete EventsCache[event.base][event.name][index];
        }
    }
}

var event_handler = {
    InternalEventHandler: InternalEventHandler,
    EventHandler: GlobalEventHandler,
    EventItem: EventItem,
    Event: Event,
    EventsCache: EventsCache
};

const {InternalEventHandler: InternalEventHandler$1, GlobalEventHandler: GlobalEventHandler$1, EventItem: EventItem$1, Event: Event$1, EventsCache: EventsCache$1} = event_handler;

class RtmpServerEvents {
    static get AllEvents() {
        return [
            RtmpServerEvents.Started,
            RtmpServerEvents.Connection,
            RtmpServerEvents.Error,
            RtmpServerEvents.Close
        ]
    }

    static get Info() {
        return new EventItem$1("info", "RtmpServerEvents");
    }

    static get Started() {
        return new EventItem$1("started", "RtmpServerEvents");
    }

    static get Connection() {
        return new EventItem$1("connection", "RtmpServerEvents");
    }

    static get Error() {
        return new EventItem$1("error", "RtmpServerEvents");
    }

    static get Close() {
        return new EventItem$1("close", "RtmpServerEvents");
    }
}

class RtmpRelayEvents {
    static get AllEvents() {
        return [
            RtmpRelayEvents.Auth,
            RtmpRelayEvents.Disconnect,
            RtmpRelayEvents.Error,
            RtmpRelayEvents.Connect,
            RtmpRelayEvents.Publish,
            RtmpRelayEvents.Close
        ]
    }

    static get Error() {
        return new EventItem$1("error", "RtmpRelayEvents");
    }

    static get Auth() {
        return new EventItem$1("auth", "RtmpRelayEvents");
    }

    static get PublishEnd() {
        return new EventItem$1("publishend", "RtmpRelayEvents");
    }

    static get Connect() {
        return new EventItem$1("connect", "RtmpRelayEvents");
    }

    static get Publish() {
        return new EventItem$1("publish", "RtmpRelayEvents");
    }

    static get Disconnect() {
        return new EventItem$1("disconnect", "RtmpRelayEvents");
    }

    static get Close() {
        return new EventItem$1("close", "RtmpRelayEvents");
    }

    constructor() {
    }
}

class RtmpSessionEvents {
    static get AllEvents() {
        return [
            RtmpSessionEvents.SocketClose,
            RtmpSessionEvents.DoneConnect,
            RtmpSessionEvents.PreConnect,
            RtmpSessionEvents.PostConnect,
            RtmpSessionEvents.PrePublish,
            RtmpSessionEvents.PostPublish,
            RtmpSessionEvents.PrePlay,
            RtmpSessionEvents.PostPlay,
            RtmpSessionEvents.DonePlay,
            RtmpSessionEvents.DonePublish,
        ]
    }

    static get SocketClose() {
        return new EventItem$1("close", "RtmpSessionEvents");
    }

    static get DoneConnect() {
        return new EventItem$1("doneConnect", "RtmpSessionEvents");
    }

    static get PreConnect() {
        return new EventItem$1("preConnect", "RtmpSessionEvents");
    }

    static get PostConnect() {
        return new EventItem$1("postConnect", "RtmpSessionEvents");
    }

    static get PrePublish() {
        return new EventItem$1("prePublish", "RtmpSessionEvents");
    }

    static get PostPublish() {
        return new EventItem$1("postPublish", "RtmpSessionEvents");
    }

    static get PrePlay() {
        return new EventItem$1("prePlay", "RtmpSessionEvents");
    }

    static get PostPlay() {
        return new EventItem$1("postPlay", "RtmpSessionEvents");
    }

    static get DonePlay() {
        return new EventItem$1("donePlay", "RtmpSessionEvents");
    }

    static get DonePublish() {
        return new EventItem$1("donePublish", "RtmpSessionEvents");
    }
}

class FFmpegEvents {
    static get AllEvents() {
        return [
            FFmpegEvents.Starting,
            FFmpegEvents.Started,
            FFmpegEvents.Stderr,
            FFmpegEvents.Stdout,
            FFmpegEvents.Error,
            FFmpegEvents.Close
        ]
    }

    static get Starting() {
        return new EventItem$1("starting", "FFmpegEvents");
    };

    static get Started() {
        return new EventItem$1("started", "FFmpegEvents");
    };

    static get Error() {
        return new EventItem$1("error", "FFmpegEvents");
    };

    static get Stdout() {
        return new EventItem$1("stdout", "FFmpegEvents");
    };

    static get Stderr() {
        return new EventItem$1("stderr", "FFmpegEvents");
    };

    static get Close() {
        return new EventItem$1("close", "FFmpegEvents");
    };
}

class FlvSessionEvents {
    static get PreConnect() {
        return new EventItem$1("preConnect", "FlvSessionEvents");
    }

    static get PostConnect() {
        return new EventItem$1("postConnect", "FlvSessionEvents");
    }

    static get DoneConnect() {
        return new EventItem$1("doneConnect", "FlvSessionEvents");
    }

    static get PrePlay() {
        return new EventItem$1("prePlay", "FlvSessionEvents");
    }

    static get PostPlay() {
        return new EventItem$1("postPlay", "FlvSessionEvents");
    }

    static get DonePlay() {
        return new EventItem$1("donePlay", "FlvSessionEvents");
    }
}

var events = {
    InternalEventHandler: InternalEventHandler$1,
    EventHandler: GlobalEventHandler$1,
    EventItem: EventItem$1,
    Event: Event$1,
    EventsCache: EventsCache$1,
    RtmpServerEvents: RtmpServerEvents,
    RtmpRelayEvents: RtmpRelayEvents,
    RtmpSessionEvents: RtmpSessionEvents,
    FFmpegEvents: FFmpegEvents,
    FlvSessionEvents: FlvSessionEvents
};

class helpers {
    static isFunction(test) {
        return (Object.prototype.toString.call(test).indexOf("Function") > -1);
    };

    static isEmptyObject(obj) {
        if (typeof obj === "string") {
            return obj.length === 0 ? true : false;
        } else if (obj === null) {
            return true;
        } else if (obj === undefined) {
            return true;
        } else if (typeof obj === "number") {
            return false;
        } else if (typeof obj === "boolean") {
            return false;
        } else if (!Array.isArray(obj) && typeof obj === "object") {
            return Object.keys(obj).length === 0 ? true : false;
        } else if (helpers.isFunction(obj)) {
            return true;
        } else if (Array.isArray(obj)) {
            return obj.length === 0 ? true : false;
        }
        return true;
    }

    static isPrimitiveType(value) {
        switch (typeof value) {
            case "number":
            case "string":
            case "boolean":
                return true;
            default:
                return false;
        }
    }

    static isEmpty(obj) {
        if (typeof obj === "string") {
            return obj.length === 0;
        } else if (obj === null) {
            return true;
        } else if (obj === undefined) {
            return true;
        } else if (typeof obj === "number") {
            return obj === 0;
        } else if (typeof obj === "boolean") {
            return obj === false;
        } else if (!Array.isArray(obj) && typeof obj === "object") {
            return Object.keys(obj).length === 0;
        } else if (helpers.isFunction(obj)) {
            return false;
        } else if (Array.isArray(obj)) {
            return obj.length === 0;
        }
        return false;
    };

    static isSet(obj) {
        return !(obj === null || obj === undefined);
    };

    static compare(a, b, strict = true) {
        return helpers.hash(JSON.stringify(a)) === helpers.hash(JSON.stringify(b))
    }

    static hash(input) {
        if (input) {
            if (typeof input !== "string") {
                return JSON.stringify(input);
            }
            return input;
        }
        return "";
    }

    static getLines(input) {
        const regex = /^(.*)$/gmi;
        let m;
        let output = [];
        while ((m = regex.exec(input)) !== null) {
            if (m.index === regex.lastIndex) regex.lastIndex++;
            let match = m[0].replace(/\s+/gmi, " ").trim();
            if (match.length > 0) output.push(match);
        }
        return output;
    }

    static checkTimeoutArg(timeout) {
        if (typeof timeout === "boolean") {
            timeout = (timeout === true) ? 5000 : 0;
        } else if (typeof timeout === "string") {
            timeout = parseInt(timeout);
        } else if (typeof timeout !== "number") {
            timeout = 5000;
        }
        if (timeout > 0 && timeout < 1000) {
            timeout *= 1000;
        }
        return timeout;
    }

    static arrayToObject(array) {
        try {
            return array.reduce((acc, t) => {
                let arr = t.split("=");
                let k = arr[0];
                let v = arr.length > 1 ? arr[1].split(",") : [];
                if (acc.hasOwnProperty(k)) {
                    if (typeof acc[k] === "string") acc[k] = [acc[k]];
                    v = [...acc[k], ...v];
                }
                if (v.length === 1) v = v[0];
                else if (v.length === 0) v = "";
                return ({...acc, [k]: v});
            }, {});
        } catch (e) {
            return {};
        }
    }
}

if (!String.prototype.toCamelCase) {
    String.prototype.toCamelCase = function () {
        if (this.length > 1) {
            return this[0].toUpperCase() + this.substr(1);
        } else if (this.length > 0) {
            return this[0].toUpperCase();
        }
        return this;
    };
}
if (!Array.prototype.last) {
    Array.prototype.last = function () {
        return this[this.length - 1];
    };
}
var helpers_1 = helpers;

const FFmpegDefaultArguments = {
    help: {
        h: {
            usage: '-h type=name',
            info: 'print all options for the named decoder/encoder/demuxer/muxer/filter/bsf/protocol',
            com: '-h'
        }
    },
    information: {
        L: {usage: '-L', info: 'show license', com: '-L'},
        h: {usage: '-h topic', info: 'show help', com: '-h'},
        '?': {usage: '-? topic', info: 'show help', com: '-?'},
        help: {usage: '-help topic', info: 'show help', com: '-help'},
        version: {usage: '-version', info: 'show version', com: '-version'},
        buildconf: {
            usage: '-buildconf',
            info: 'show build configuration',
            com: '-buildconf'
        },
        formats: {
            usage: '-formats',
            info: 'show available formats',
            com: '-formats'
        },
        muxers: {usage: '-muxers', info: 'show available muxers', com: '-muxers'},
        demuxers: {
            usage: '-demuxers',
            info: 'show available demuxers',
            com: '-demuxers'
        },
        devices: {
            usage: '-devices',
            info: 'show available devices',
            com: '-devices'
        },
        codecs: {usage: '-codecs', info: 'show available codecs', com: '-codecs'},
        decoders: {
            usage: '-decoders',
            info: 'show available decoders',
            com: '-decoders'
        },
        encoders: {
            usage: '-encoders',
            info: 'show available encoders',
            com: '-encoders'
        },
        bsfs: {
            usage: '-bsfs',
            info: 'show available bit stream filters',
            com: '-bsfs'
        },
        protocols: {
            usage: '-protocols',
            info: 'show available protocols',
            com: '-protocols'
        },
        filters: {
            usage: '-filters',
            info: 'show available filters',
            com: '-filters'
        },
        pix_fmts: {
            usage: '-pix_fmts',
            info: 'show available pixel formats',
            com: '-pix_fmts'
        },
        layouts: {
            usage: '-layouts',
            info: 'show standard channel layouts',
            com: '-layouts'
        },
        sample_fmts: {
            usage: '-sample_fmts',
            info: 'show available audio sample formats',
            com: '-sample_fmts'
        },
        colors: {
            usage: '-colors',
            info: 'show available color names',
            com: '-colors'
        },
        sources: {
            usage: '-sources device',
            info: 'list sources of the input device',
            com: '-sources'
        },
        sinks: {
            usage: '-sinks device',
            info: 'list sinks of the output device',
            com: '-sinks'
        },
        hwaccels: {
            usage: '-hwaccels',
            info: 'show available HW acceleration methods',
            com: '-hwaccels'
        }
    },
    global: {
        loglevel: {
            usage: '-loglevel loglevel',
            info: 'set logging level',
            com: '-loglevel'
        },
        v: {usage: '-v loglevel', info: 'set logging level', com: '-v'},
        report: {usage: '-report', info: 'generate a report', com: '-report'},
        max_alloc: {
            usage: '-max_alloc bytes',
            info: 'set maximum size of a single allocated block',
            com: '-max_alloc'
        },
        y: {usage: '-y', info: 'overwrite output files', com: '-y'},
        n: {usage: '-n', info: 'never overwrite output files', com: '-n'},
        ignore_unknown: {
            usage: '-ignore_unknown',
            info: 'Ignore unknown stream types',
            com: '-ignore_unknown'
        },
        filter_threads: {
            usage: '-filter_threads',
            info: 'number of non-complex filter threads',
            com: '-filter_threads'
        },
        filter_complex_threads: {
            usage: '-filter_complex_threads',
            info: 'number of threads for -filter_complex',
            com: '-filter_complex_threads'
        },
        stats: {
            usage: '-stats',
            info: 'print progress report during encoding',
            com: '-stats'
        },
        max_error_rate: {
            usage: '-max_error_rate maximum error rate',
            info: 'ratio of errors (0.0: no errors, 1.0: 100% errors) above which ffmpeg returns an error instead of success.',
            com: '-max_error_rate'
        },
        bits_per_raw_sample: {
            usage: '-bits_per_raw_sample number',
            info: 'set the number of bits per raw sample',
            com: '-bits_per_raw_sample'
        },
        vol: {
            usage: '-vol volume',
            info: 'change audio volume (256=normal)',
            com: '-vol'
        }
    },
    file: {
        i: {usage: "-i input", info: 'input file', com: '-i'},
        f: {usage: '-f fmt', info: 'force format', com: '-f'},
        c: {usage: '-c codec', info: 'codec name', com: '-c'},
        codec: {usage: '-codec codec', info: 'codec name', com: '-codec'},
        pre: {usage: '-pre preset', info: 'preset name', com: '-pre'},
        map_metadata: {
            usage: '-map_metadata outfile[,metadata]:infile[,metadata]',
            info: 'set metadata information of outfile from infile',
            com: '-map_metadata'
        },
        t: {
            usage: '-t duration',
            info: 'record or transcode "duration" seconds of audio/video',
            com: '-t'
        },
        to: {
            usage: '-to time_stop',
            info: 'record or transcode stop time',
            com: '-to'
        },
        fs: {
            usage: '-fs limit_size',
            info: 'set the limit file size in bytes',
            com: '-fs'
        },
        ss: {
            usage: '-ss time_off',
            info: 'set the start time offset',
            com: '-ss'
        },
        sseof: {
            usage: '-sseof time_off',
            info: 'set the start time offset relative to EOF',
            com: '-sseof'
        },
        seek_timestamp: {
            usage: '-seek_timestamp',
            info: 'enable/disable seeking by timestamp with -ss',
            com: '-seek_timestamp'
        },
        timestamp: {
            usage: '-timestamp time',
            info: "set the recording timestamp ('now' to set the current time)",
            com: '-timestamp'
        },
        metadata: {
            usage: '-metadata string=string',
            info: 'add metadata',
            com: '-metadata'
        },
        program: {
            usage: '-program title=string:st=number...',
            info: 'add program with specified streams',
            com: '-program'
        },
        target: {
            usage: '-target type',
            info: 'specify target file type ("vcd", "svcd", "dvd", "dv" or "dv50" with optional prefixes "pal-", "ntsc-" or "film-")',
            com: '-target'
        },
        apad: {usage: '-apad', info: 'audio pad', com: '-apad'},
        frames: {
            usage: '-frames number',
            info: 'set the number of frames to output',
            com: '-frames'
        },
        filter: {
            usage: '-filter filter_graph',
            info: 'set stream filtergraph',
            com: '-filter'
        },
        filter_script: {
            usage: '-filter_script filename',
            info: 'read stream filtergraph description from a file',
            com: '-filter_script'
        },
        reinit_filter: {
            usage: '-reinit_filter',
            info: 'reinit filtergraph on input parameter changes',
            com: '-reinit_filter'
        },
        discard: {usage: '-discard', info: 'discard', com: '-discard'},
        disposition: {usage: '-disposition', info: 'disposition', com: '-disposition'}
    },
    video: {
        vframes: {
            usage: '-vframes number',
            info: 'set the number of video frames to output',
            com: '-vframes'
        },
        r: {
            usage: '-r rate',
            info: 'set frame rate (Hz value, fraction or abbreviation)',
            com: '-r'
        },
        s: {
            usage: '-s size',
            info: 'set frame size (WxH or abbreviation)',
            com: '-s'
        },
        aspect: {
            usage: '-aspect aspect',
            info: 'set aspect ratio (4:3, 16:9 or 1.3333, 1.7777)',
            com: '-aspect'
        },
        bits_per_raw_sample: {
            usage: '-bits_per_raw_sample number',
            info: 'set the number of bits per raw sample',
            com: '-bits_per_raw_sample'
        },
        vn: {usage: '-vn', info: 'disable video', com: '-vn'},
        vcodec: {
            usage: '-vcodec codec',
            info: "force video codec ('copy' to copy stream)",
            com: '-vcodec'
        },
        timecode: {
            usage: '-timecode hh:mm:ss[:;.]ff',
            info: 'set initial TimeCode value.',
            com: '-timecode'
        },
        pass: {
            usage: '-pass n',
            info: 'select the pass number (1 to 3)',
            com: '-pass'
        },
        vf: {usage: '-vf filter_graph', info: 'set video filters', com: '-vf'},
        ab: {
            usage: '-ab bitrate',
            info: 'audio bitrate (please use -b:a)',
            com: '-ab'
        },
        b: {
            usage: '-b bitrate',
            info: 'video bitrate (please use -b:v)',
            com: '-b'
        },
        dn: {usage: '-dn', info: 'disable data', com: '-dn'}
    },
    audio: {
        aframes: {
            usage: '-aframes number',
            info: 'set the number of audio frames to output',
            com: '-aframes'
        },
        aq: {
            usage: '-aq quality',
            info: 'set audio quality (codec-specific)',
            com: '-aq'
        },
        ar: {
            usage: '-ar rate',
            info: 'set audio sampling rate (in Hz)',
            com: '-ar'
        },
        ac: {
            usage: '-ac channels',
            info: 'set number of audio channels',
            com: '-ac'
        },
        an: {usage: '-an', info: 'disable audio', com: '-an'},
        acodec: {
            usage: '-acodec codec',
            info: "force audio codec ('copy' to copy stream)",
            com: '-acodec'
        },
        vol: {
            usage: '-vol volume',
            info: 'change audio volume (256=normal)',
            com: '-vol'
        },
        af: {usage: '-af filter_graph', info: 'set audio filters', com: '-af'}
    },
    subtitle: {
        s: {
            usage: '-s size',
            info: 'set frame size (WxH or abbreviation)',
            com: '-s'
        },
        sn: {usage: '-sn', info: 'disable subtitle', com: '-sn'},
        scodec: {
            usage: '-scodec codec',
            info: "force subtitle codec ('copy' to copy stream)",
            com: '-scodec'
        },
        stag: {
            usage: '-stag fourcc/tag',
            info: 'force subtitle tag/fourcc',
            com: '-stag'
        },
        fix_sub_duration: {
            usage: '-fix_sub_duration',
            info: 'fix subtitles duration',
            com: '-fix_sub_duration'
        },
        canvas_size: {
            usage: '-canvas_size size',
            info: 'set canvas size (WxH or abbreviation)',
            com: '-canvas_size'
        },
        spre: {
            usage: '-spre preset',
            info: 'set the subtitle options to the indicated preset',
            com: '-spre'
        }
    }
};

function checkCommand(command) {
    if (typeof command !== "string" && command.hasOwnProperty("com")) {
        command = command.com;
    } else if (typeof command !== "string") {
        throw new Error("command must be of type string or object {com: 'command'}")
    }
    return command;
}

class FFmpegArgs {
    static getDefault(input, output) {
        if (!Array.isArray(output)) {
            output = [output];
        }
        return new FFmpegArgs([
            {"-rw_timeout": "10000000"},
            {"-hide_banner": ""},
            {"-y": ""},
            {"-i": input},
            {"-c:v": "copy"},
            {"-c:a": "copy"},
            {"-f": "tee"},
            {"-map": "0:v?"},
            {"-map": "0:a?"},
            {"-map": "0:s?"},
            {"": "'[f=flv]" + output.join("|[f=flv]") + "'"}
        ]);
    }

    add(command, args) {
        if (!helpers_1.isPrimitiveType(args)) {
            throw new Error("args must be of type string");
        }
        command = checkCommand(command);
        this._args.push({
            com: command,
            args: args.toString()
        });
    }

    set(command, args) {
        if (!helpers_1.isPrimitiveType(args)) {
            throw new Error("args must be of type string");
        }
        command = checkCommand(command);
        let item = this._args.find((t) => t.com === command);
        if (item) {
            item.args = args.toString();
            return true;
        }
        return false;
    }

    get argString() {
        let commandLine = "";
        this._args.forEach((item) => {
            commandLine += item.com + " " + (item.args.length > 0 ? (item.args + " ") : "");
        });
        return commandLine;
    }

    get args() {
        let commandArr = [];
        this._args.forEach((item) => {
            if (item.com.length > 0) {
                commandArr.push(item.com);
            }
            if (item.args.length > 0) {
                commandArr.push(item.args);
            }
        });
        return commandArr;
    }

    constructor(defaultArgs = []) {
        this._args = [];
        const _this = this;
        defaultArgs.forEach((arg) => {
            if (typeof arg === "string") {
                let arr = arg.split(" ", 2);
                _this.add(arr[0], arr[1]);
            } else {
                for (let key in arg) {
                    _this.add(key, arg[key]);
                }
            }
        });
    }
}

var ffmpeg_args = {
    FFmpegArgs: FFmpegArgs,
    FFmpegDefaultArguments: FFmpegDefaultArguments
};

function checkLevel(logLevel) {
    if (logLevel instanceof LogLevel) {
        return logLevel;
    } else {
        return new LogLevel(logLevel);
    }
}

const LogLevelNames = {
    0: "(none)   ",
    1: "(error)  ",
    2: "(verbose)",
    3: "(debug)  "
};

class LogLevel {
    static get Debug() {
        return new LogLevel(3);
    }

    static get Verbose() {
        return new LogLevel(2);
    }

    static get Error() {
        return new LogLevel(1);
    }

    static get None() {
        return new LogLevel(0);
    }

    get level() {
        return this._lvl;
    }

    get levelName() {
        return LogLevelNames[this._lvl];
    }

    is(other) {
        if (other instanceof LogLevel) {
            return other._lvl < this._lvl;
        }
        return parseInt(other) < this._lvl;
    }

    equals(other) {
        if (other instanceof LogLevel) {
            return other._lvl === this._lvl;
        }
        return other === this._lvl;
    }

    constructor(logLevel) {
        if (logLevel instanceof LogLevel) {
            this._lvl = logLevel._lvl;
        } else {
            this._lvl = parseInt(logLevel);
        }
    }

    toString() {
        return this._lvl.toString();
    }
}

class ConsoleLogger {
    get prettyPrint() {
        return this._pretty;
    }

    set prettyPrint(value) {
        this._pretty = value;
    }

    get name() {
        return this._name;
    }

    get levelName() {
        return LogLevelNames[this._lvl];
    }

    get level() {
        return this._lvl;
    }

    set level(level) {
        if (level instanceof LogLevel) {
            this._lvl = level._lvl;
        } else {
            this._lvl = level;
        }
    }

    verbose(...args) {
        this.__log(LogLevel.Verbose, ...args);
    }

    debug(...args) {
        this.__log(LogLevel.Debug, ...args);
    }

    error(...args) {
        this.__log(LogLevel.Error, ...args);
    }

    log(...args) {
        this.__log(LogLevel.Debug, ...args);
    }

    __log(logLevel, ...data) {
        logLevel = checkLevel(logLevel);
        if (logLevel.level <= this._lvl) {
            this._log(logLevel, data);
        }
    }

    _log(logLevel, ...data) {
        let name = ("[" + this._name + "]").padEnd(14, " ");
        let args = [];
        if (data.length > 0) {
            data.forEach((item) => {
                if (Array.isArray(item)) {
                    args = [...args, ...item];
                } else {
                    args.push(item);
                }
            });
            args = args.filter((t) => !helpers_1.isEmptyObject(t));
            if (args.length > 1) {
                let text = args.splice(0, 1);
                if (args.length === 1) args = args[0];
                args = JSON.stringify(text) + " " + (this._pretty === true ? JSON.stringify(args, null, 3) : JSON.stringify(args));
            } else if (args.length > 0) {
                args = JSON.stringify(args[0]);
            } else {
                args = "";
            }
        } else {
            args = "";
        }
        if (LogLevel.Error.equals(logLevel)) {
            console.error(new Date().toTimeString().split(" ")[0] + ": " + logLevel.levelName + " " + name + " > " + args);
        } else {
            console.log(new Date().toTimeString().split(" ")[0] + ": " + logLevel.levelName + " " + name + " > " + args);
        }
    }

    constructor(baseName = "Default", logLevel = LogLevel.Verbose.level, prettyPrint = false) {
        this._name = baseName;
        if (logLevel instanceof LogLevel) {
            this._lvl = logLevel.level;
        } else {
            this._lvl = logLevel;
        }
        this._pretty = prettyPrint;
    }

    toString() {
        return this._name + ": " + LogLevelNames[this._lvl];
    }
}

var logger = {
    ConsoleLogger: ConsoleLogger,
    LogLevel: LogLevel
};

const {spawn: spawn$1} = child_process__default['default'];
const {EventHandler, InternalEventHandler: InternalEventHandler$2, Event: Event$2, EventItem: EventItem$2, EventsCache: EventsCache$2} = event_handler;
const {RtmpRelayEvents: RtmpRelayEvents$1, RtmpServerEvents: RtmpServerEvents$1, RtmpSessionEvents: RtmpSessionEvents$1, FFmpegEvents: FFmpegEvents$1} = events;
const {FFmpegArgs: FFmpegArgs$1, FFmpegDefaultArguments: FFmpegDefaultArguments$1} = ffmpeg_args;
const {ConsoleLogger: ConsoleLogger$1, LogLevel: LogLevel$1} = logger;
const Logger = new ConsoleLogger$1("FFMPEG");
const ffmpegIds = new Map();

class PushServerInfo {
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

class FFmpegSession extends InternalEventHandler$2 {
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

    constructor(inputUrl, streamId, options, execPath = "ffmpeg", logLevel = null) {
        super();
        const _this = this;
        options.input = inputUrl;
        this.config = options;
        this.config.logLevel = Logger.level = options.logLevel || logLevel || LogLevel$1.Verbose;
        this.stats = {};
        if (!(options.ffmpegArgs instanceof FFmpegArgs$1) && Array.isArray(options.ffmpegArgs) && options.ffmpegArgs.length > 0) {
            options.ffmpegArgs = new FFmpegArgs$1(options.ffmpegArgs);
        } else {
            options.ffmpegArgs = FFmpegArgs$1.getDefault(inputUrl, options.urls);
        }
        this.arguments = options.ffmpegArgs;
        const ffargs = this.arguments.args;
        this.streamId = streamId;
        this.id = options.id;
        ffmpegIds.set(this.id, this);
        let lastErrors = [];
        let hasStarted = false;
        this.ffmpeg_proc = spawn$1(execPath, ffargs);
        Logger.verbose("(" + _this.id + ") starting: [" + _this.streamId + "]", {
            input: inputUrl,
            output: options.urls,
            args: ffargs
        });
        _this.emit(FFmpegEvents$1.Starting, {ffmpegId: this.id, streamId: this.streamId});
        this.ffmpeg_proc.on('error', (e) => {
            _this.emit(FFmpegEvents$1.Error, {error: e});
            Logger.error("(" + _this.id + ") error: [" + _this.streamId + "]", e);
        });
        this.ffmpeg_proc.stdout.on('data', (data) => {
            let d = {info: _this.info, data: data.toString()};
            _this.emit(FFmpegEvents$1.Stdout, d);
            Logger.debug("(" + _this.id + ") stdout: [" + _this.streamId + "]", data);
        });
        this.ffmpeg_proc.stderr.on('data', (data) => {
            data = data.toString().replace(/[ ]+/gmi, " ").trim();
            lastErrors.push(...helpers_1.getLines(data));
            if (lastErrors.length > 10) {
                lastErrors.splice(0, lastErrors.length - 10);
            }
            if (!hasStarted) {
                hasStarted = true;
                Logger.verbose("(" + _this.id + ") started: [" + _this.streamId + "]", _this.info);
                _this.emit(FFmpegEvents$1.Started, {info: _this.info, data: data});
            }
            _this._parseFFmpegInfo(data);
            _this.emit(FFmpegEvents$1.Stderr, {info: _this.info, data: data});
            Logger.debug("(" + _this.id + ") stderr: [" + _this.streamId + "]", data);
        });
        this.ffmpeg_proc.on('close', (code) => {
            ffmpegIds.delete(_this.id);
            if (code > 0) {
                let errLines = lastErrors.filter((t) => t.indexOf("error") >= 0 || t.indexOf("failed") >= 0);
                let errorData = {error: {exitCode: code, message: errLines, ffmpegConfig: options}};
                _this.emit(FFmpegEvents$1.Error, errorData);
                Logger.error("(" + _this.id + ") error: [" + _this.streamId + "]", errorData);
            }
            _this.emit(FFmpegEvents$1.Close, {info: _this.info, code: code});
            if (code > 0) Logger.error("(" + _this.id + ") close: [" + _this.streamId + "]", {exitCode: code});
            else Logger.verbose("(" + _this.id + ") close: [" + _this.streamId + "]", code);
        });
    }
}

var ffmpeg_session = {
    FFmpegSession: FFmpegSession,
    FFmpegEvents: FFmpegEvents$1,
    PushServerInfo: PushServerInfo
};

class Bitop {
    constructor(buffer) {
        this.buffer = buffer;
        this.buflen = buffer.length;
        this.bufpos = 0;
        this.bufoff = 0;
        this.iserro = false;
    }

    read(n) {
        let v = 0;
        let d = 0;
        while (n) {
            if (n < 0 || this.bufpos >= this.buflen) {
                this.iserro = true;
                return 0;
            }
            this.iserro = false;
            d = this.bufoff + n > 8 ? 8 - this.bufoff : n;
            v <<= d;
            v += (this.buffer[this.bufpos] >> (8 - this.bufoff - d)) & (0xff >> (8 - d));
            this.bufoff += d;
            n -= d;
            if (this.bufoff == 8) {
                this.bufpos++;
                this.bufoff = 0;
            }
        }
        return v;
    }

    look(n) {
        let p = this.bufpos;
        let o = this.bufoff;
        let v = this.read(n);
        this.bufpos = p;
        this.bufoff = o;
        return v;
    }

    read_golomb() {
        let n;
        for (n = 0; this.read(1) == 0 && !this.iserro; n++) ;
        return (1 << n) + this.read(n) - 1;
    }
}

var core_bitop = Bitop;

const AAC_SAMPLE_RATE = [
    96000, 88200, 64000, 48000,
    44100, 32000, 24000, 22050,
    16000, 12000, 11025, 8000,
    7350, 0, 0, 0
];
const AAC_CHANNELS = [
    0, 1, 2, 3, 4, 5, 6, 8
];
const AUDIO_CODEC_NAME = [
    '',
    'ADPCM',
    'MP3',
    'LinearLE',
    'Nellymoser16',
    'Nellymoser8',
    'Nellymoser',
    'G711A',
    'G711U',
    '',
    'AAC',
    'Speex',
    '',
    '',
    'MP3-8K',
    'DeviceSpecific',
    'Uncompressed'
];
const AUDIO_SOUND_RATE = [
    5512, 11025, 22050, 44100
];
const VIDEO_CODEC_NAME = [
    '',
    'Jpeg',
    'Sorenson-H263',
    'ScreenVideo',
    'On2-VP6',
    'On2-VP6-Alpha',
    'ScreenVideo2',
    'H264',
    '',
    '',
    '',
    '',
    'H265'
];

function getObjectType(bitop) {
    let audioObjectType = bitop.read(5);
    if (audioObjectType === 31) {
        audioObjectType = bitop.read(6) + 32;
    }
    return audioObjectType;
}

function getSampleRate(bitop, info) {
    info.sampling_index = bitop.read(4);
    return info.sampling_index == 0x0f ? bitop.read(24) : AAC_SAMPLE_RATE[info.sampling_index];
}

function readAACSpecificConfig(aacSequenceHeader) {
    let info = {};
    let bitop = new core_bitop(aacSequenceHeader);
    bitop.read(16);
    info.object_type = getObjectType(bitop);
    info.sample_rate = getSampleRate(bitop, info);
    info.chan_config = bitop.read(4);
    if (info.chan_config < AAC_CHANNELS.length) {
        info.channels = AAC_CHANNELS[info.chan_config];
    }
    info.sbr = -1;
    info.ps = -1;
    if (info.object_type == 5 || info.object_type == 29) {
        if (info.object_type == 29) {
            info.ps = 1;
        }
        info.ext_object_type = 5;
        info.sbr = 1;
        info.sample_rate = getSampleRate(bitop, info);
        info.object_type = getObjectType(bitop);
    }
    return info;
}

function getAACProfileName(info) {
    switch (info.object_type) {
        case 1:
            return 'Main';
        case 2:
            if (info.ps > 0) {
                return 'HEv2';
            }
            if (info.sbr > 0) {
                return 'HE';
            }
            return 'LC';
        case 3:
            return 'SSR';
        case 4:
            return 'LTP';
        case 5:
            return 'SBR';
        default:
            return '';
    }
}

function readH264SpecificConfig(avcSequenceHeader) {
    let info = {};
    let profile_idc, width, height, crop_left, crop_right,
        crop_top, crop_bottom, frame_mbs_only, n, cf_idc,
        num_ref_frames;
    let bitop = new core_bitop(avcSequenceHeader);
    bitop.read(48);
    info.width = 0;
    info.height = 0;
    do {
        info.profile = bitop.read(8);
        info.compat = bitop.read(8);
        info.level = bitop.read(8);
        info.nalu = (bitop.read(8) & 0x03) + 1;
        info.nb_sps = bitop.read(8) & 0x1F;
        if (info.nb_sps == 0) {
            break;
        }
        bitop.read(16);
        if (bitop.read(8) != 0x67) {
            break;
        }
        profile_idc = bitop.read(8);
        bitop.read(8);
        bitop.read(8);
        bitop.read_golomb();
        if (profile_idc == 100 || profile_idc == 110 ||
            profile_idc == 122 || profile_idc == 244 || profile_idc == 44 ||
            profile_idc == 83 || profile_idc == 86 || profile_idc == 118) {
            cf_idc = bitop.read_golomb();
            if (cf_idc == 3) {
                bitop.read(1);
            }
            bitop.read_golomb();
            bitop.read_golomb();
            bitop.read(1);
            if (bitop.read(1)) {
                for (n = 0; n < (cf_idc != 3 ? 8 : 12); n++) {
                    if (bitop.read(1)) ;
                }
            }
        }
        bitop.read_golomb();
        switch (bitop.read_golomb()) {
            case 0:
                bitop.read_golomb();
                break;
            case 1:
                bitop.read(1);
                bitop.read_golomb();
                bitop.read_golomb();
                num_ref_frames = bitop.read_golomb();
                for (n = 0; n < num_ref_frames; n++) {
                    bitop.read_golomb();
                }
        }
        info.avc_ref_frames = bitop.read_golomb();
        bitop.read(1);
        width = bitop.read_golomb();
        height = bitop.read_golomb();
        frame_mbs_only = bitop.read(1);
        if (!frame_mbs_only) {
            bitop.read(1);
        }
        bitop.read(1);
        if (bitop.read(1)) {
            crop_left = bitop.read_golomb();
            crop_right = bitop.read_golomb();
            crop_top = bitop.read_golomb();
            crop_bottom = bitop.read_golomb();
        } else {
            crop_left = 0;
            crop_right = 0;
            crop_top = 0;
            crop_bottom = 0;
        }
        info.level = info.level / 10.0;
        info.width = (width + 1) * 16 - (crop_left + crop_right) * 2;
        info.height = (2 - frame_mbs_only) * (height + 1) * 16 - (crop_top + crop_bottom) * 2;
    } while (0);
    return info;
}

function HEVCParsePtl(bitop, hevc, max_sub_layers_minus1) {
    let general_ptl = {};
    general_ptl.profile_space = bitop.read(2);
    general_ptl.tier_flag = bitop.read(1);
    general_ptl.profile_idc = bitop.read(5);
    general_ptl.profile_compatibility_flags = bitop.read(32);
    general_ptl.general_progressive_source_flag = bitop.read(1);
    general_ptl.general_interlaced_source_flag = bitop.read(1);
    general_ptl.general_non_packed_constraint_flag = bitop.read(1);
    general_ptl.general_frame_only_constraint_flag = bitop.read(1);
    bitop.read(32);
    bitop.read(12);
    general_ptl.level_idc = bitop.read(8);
    general_ptl.sub_layer_profile_present_flag = [];
    general_ptl.sub_layer_level_present_flag = [];
    for (let i = 0; i < max_sub_layers_minus1; i++) {
        general_ptl.sub_layer_profile_present_flag[i] = bitop.read(1);
        general_ptl.sub_layer_level_present_flag[i] = bitop.read(1);
    }
    if (max_sub_layers_minus1 > 0) {
        for (let i = max_sub_layers_minus1; i < 8; i++) {
            bitop.read(2);
        }
    }
    general_ptl.sub_layer_profile_space = [];
    general_ptl.sub_layer_tier_flag = [];
    general_ptl.sub_layer_profile_idc = [];
    general_ptl.sub_layer_profile_compatibility_flag = [];
    general_ptl.sub_layer_progressive_source_flag = [];
    general_ptl.sub_layer_interlaced_source_flag = [];
    general_ptl.sub_layer_non_packed_constraint_flag = [];
    general_ptl.sub_layer_frame_only_constraint_flag = [];
    general_ptl.sub_layer_level_idc = [];
    for (let i = 0; i < max_sub_layers_minus1; i++) {
        if (general_ptl.sub_layer_profile_present_flag[i]) {
            general_ptl.sub_layer_profile_space[i] = bitop.read(2);
            general_ptl.sub_layer_tier_flag[i] = bitop.read(1);
            general_ptl.sub_layer_profile_idc[i] = bitop.read(5);
            general_ptl.sub_layer_profile_compatibility_flag[i] = bitop.read(32);
            general_ptl.sub_layer_progressive_source_flag[i] = bitop.read(1);
            general_ptl.sub_layer_interlaced_source_flag[i] = bitop.read(1);
            general_ptl.sub_layer_non_packed_constraint_flag[i] = bitop.read(1);
            general_ptl.sub_layer_frame_only_constraint_flag[i] = bitop.read(1);
            bitop.read(32);
            bitop.read(12);
        }
        if (general_ptl.sub_layer_level_present_flag[i]) {
            general_ptl.sub_layer_level_idc[i] = bitop.read(8);
        } else {
            general_ptl.sub_layer_level_idc[i] = 1;
        }
    }
    return general_ptl;
}

function HEVCParseSPS(SPS, hevc) {
    let psps = {};
    let NumBytesInNALunit = SPS.length;
    let rbsp_array = [];
    let bitop = new core_bitop(SPS);
    bitop.read(1);
    bitop.read(6);
    bitop.read(6);
    bitop.read(3);
    for (let i = 2; i < NumBytesInNALunit; i++) {
        if (i + 2 < NumBytesInNALunit && bitop.look(24) == 0x000003) {
            rbsp_array.push(bitop.read(8));
            rbsp_array.push(bitop.read(8));
            i += 2;
            let emulation_prevention_three_byte = bitop.read(8);
        } else {
            rbsp_array.push(bitop.read(8));
        }
    }
    let rbsp = Buffer.from(rbsp_array);
    let rbspBitop = new core_bitop(rbsp);
    psps.sps_video_parameter_set_id = rbspBitop.read(4);
    psps.sps_max_sub_layers_minus1 = rbspBitop.read(3);
    psps.sps_temporal_id_nesting_flag = rbspBitop.read(1);
    psps.profile_tier_level = HEVCParsePtl(rbspBitop, hevc, psps.sps_max_sub_layers_minus1);
    psps.sps_seq_parameter_set_id = rbspBitop.read_golomb();
    psps.chroma_format_idc = rbspBitop.read_golomb();
    if (psps.chroma_format_idc == 3) {
        psps.separate_colour_plane_flag = rbspBitop.read(1);
    } else {
        psps.separate_colour_plane_flag = 0;
    }
    psps.pic_width_in_luma_samples = rbspBitop.read_golomb();
    psps.pic_height_in_luma_samples = rbspBitop.read_golomb();
    psps.conformance_window_flag = rbspBitop.read(1);
    if (psps.conformance_window_flag) {
        let vert_mult = 1 + (psps.chroma_format_idc < 2);
        let horiz_mult = 1 + (psps.chroma_format_idc < 3);
        psps.conf_win_left_offset = rbspBitop.read_golomb() * horiz_mult;
        psps.conf_win_right_offset = rbspBitop.read_golomb() * horiz_mult;
        psps.conf_win_top_offset = rbspBitop.read_golomb() * vert_mult;
        psps.conf_win_bottom_offset = rbspBitop.read_golomb() * vert_mult;
    }
    return psps;
}

function readHEVCSpecificConfig(hevcSequenceHeader) {
    let info = {};
    info.width = 0;
    info.height = 0;
    info.profile = 0;
    info.level = 0;
    hevcSequenceHeader = hevcSequenceHeader.slice(5);
    do {
        let hevc = {};
        if (hevcSequenceHeader.length < 23) {
            break;
        }
        hevc.configurationVersion = hevcSequenceHeader[0];
        if (hevc.configurationVersion != 1) {
            break;
        }
        hevc.general_profile_space = (hevcSequenceHeader[1] >> 6) & 0x03;
        hevc.general_tier_flag = (hevcSequenceHeader[1] >> 5) & 0x01;
        hevc.general_profile_idc = hevcSequenceHeader[1] & 0x1F;
        hevc.general_profile_compatibility_flags = (hevcSequenceHeader[2] << 24) | (hevcSequenceHeader[3] << 16) | (hevcSequenceHeader[4] << 8) | hevcSequenceHeader[5];
        hevc.general_constraint_indicator_flags = ((hevcSequenceHeader[6] << 24) | (hevcSequenceHeader[7] << 16) | (hevcSequenceHeader[8] << 8) | hevcSequenceHeader[9]);
        hevc.general_constraint_indicator_flags = (hevc.general_constraint_indicator_flags << 16) | (hevcSequenceHeader[10] << 8) | hevcSequenceHeader[11];
        hevc.general_level_idc = hevcSequenceHeader[12];
        hevc.min_spatial_segmentation_idc = ((hevcSequenceHeader[13] & 0x0F) << 8) | hevcSequenceHeader[14];
        hevc.parallelismType = hevcSequenceHeader[15] & 0x03;
        hevc.chromaFormat = hevcSequenceHeader[16] & 0x03;
        hevc.bitDepthLumaMinus8 = hevcSequenceHeader[17] & 0x07;
        hevc.bitDepthChromaMinus8 = hevcSequenceHeader[18] & 0x07;
        hevc.avgFrameRate = (hevcSequenceHeader[19] << 8) | hevcSequenceHeader[20];
        hevc.constantFrameRate = (hevcSequenceHeader[21] >> 6) & 0x03;
        hevc.numTemporalLayers = (hevcSequenceHeader[21] >> 3) & 0x07;
        hevc.temporalIdNested = (hevcSequenceHeader[21] >> 2) & 0x01;
        hevc.lengthSizeMinusOne = hevcSequenceHeader[21] & 0x03;
        let numOfArrays = hevcSequenceHeader[22];
        let p = hevcSequenceHeader.slice(23);
        for (let i = 0; i < numOfArrays; i++) {
            if (p.length < 3) {
                brak;
            }
            let nalutype = p[0];
            let n = (p[1]) << 8 | p[2];
            p = p.slice(3);
            for (let j = 0; j < n; j++) {
                if (p.length < 2) {
                    break;
                }
                k = (p[0] << 8) | p[1];
                if (p.length < 2 + k) {
                    break;
                }
                p = p.slice(2);
                if (nalutype == 33) {
                    let sps = Buffer.alloc(k);
                    p.copy(sps, 0, 0, k);
                    hevc.psps = HEVCParseSPS(sps, hevc);
                    info.profile = hevc.general_profile_idc;
                    info.level = hevc.general_level_idc / 30.0;
                    info.width = hevc.psps.pic_width_in_luma_samples - (hevc.psps.conf_win_left_offset + hevc.psps.conf_win_right_offset);
                    info.height = hevc.psps.pic_height_in_luma_samples - (hevc.psps.conf_win_top_offset + hevc.psps.conf_win_bottom_offset);
                }
                p = p.slice(k);
            }
        }
    } while (0);
    return info;
}

function readAVCSpecificConfig(avcSequenceHeader) {
    let codec_id = avcSequenceHeader[0] & 0x0f;
    if (codec_id == 7) {
        return readH264SpecificConfig(avcSequenceHeader);
    } else if (codec_id == 12) {
        return readHEVCSpecificConfig(avcSequenceHeader);
    }
}

function getAVCProfileName(info) {
    switch (info.profile) {
        case 1:
            return 'Main';
        case 2:
            return 'Main 10';
        case 3:
            return 'Main Still Picture';
        case 66:
            return 'Baseline';
        case 77:
            return 'Main';
        case 100:
            return 'High';
        default:
            return '';
    }
}

var core_av = {
    AUDIO_SOUND_RATE,
    AUDIO_CODEC_NAME,
    VIDEO_CODEC_NAME,
    readAACSpecificConfig,
    getAACProfileName,
    readAVCSpecificConfig,
    getAVCProfileName,
};

const amf3dRules = {
    0x00: amf3decUndefined,
    0x01: amf3decNull,
    0x02: amf3decFalse,
    0x03: amf3decTrue,
    0x04: amf3decInteger,
    0x05: amf3decDouble,
    0x06: amf3decString,
    0x07: amf3decXmlDoc,
    0x08: amf3decDate,
    0x09: amf3decArray,
    0x0A: amf3decObject,
    0x0B: amf3decXml,
    0x0C: amf3decByteArray
};
const amf3eRules = {
    'string': amf3encString,
    'integer': amf3encInteger,
    'double': amf3encDouble,
    'xml': amf3encXmlDoc,
    'object': amf3encObject,
    'array': amf3encArray,
    'sarray': amf3encArray,
    'binary': amf3encByteArray,
    'true': amf3encTrue,
    'false': amf3encFalse,
    'undefined': amf3encUndefined,
    'null': amf3encNull
};
const amf0dRules = {
    0x00: amf0decNumber,
    0x01: amf0decBool,
    0x02: amf0decString,
    0x03: amf0decObject,
    0x05: amf0decNull,
    0x06: amf0decUndefined,
    0x07: amf0decRef,
    0x08: amf0decArray,
    0x0A: amf0decSArray,
    0x0B: amf0decDate,
    0x0C: amf0decLongString,
    0x0F: amf0decXmlDoc,
    0x10: amf0decTypedObj,
    0x11: amf0decSwitchAmf3
};
const amf0eRules = {
    'string': amf0encString,
    'integer': amf0encNumber,
    'double': amf0encNumber,
    'xml': amf0encXmlDoc,
    'object': amf0encObject,
    'array': amf0encArray,
    'sarray': amf0encSArray,
    'binary': amf0encString,
    'true': amf0encBool,
    'false': amf0encBool,
    'undefined': amf0encUndefined,
    'null': amf0encNull
};

function amfType(o) {
    let jsType = typeof o;
    if (o === null) return 'null';
    if (jsType == 'undefined') return 'undefined';
    if (jsType == 'number') {
        if (parseInt(o) == o) return 'integer';
        return 'double';
    }
    if (jsType == 'boolean') return o ? 'true' : 'false';
    if (jsType == 'string') return 'string';
    if (jsType == 'object') {
        if (o instanceof Array) {
            if (o.sarray) return 'sarray';
            return 'array';
        }
        return 'object';
    }
    throw new Error('Unsupported type!')
}

function amf3decUndefined() {
    return {len: 1, value: undefined}
}

function amf3encUndefined() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x00);
    return buf;
}

function amf3decNull() {
    return {len: 1, value: null}
}

function amf3encNull() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x01);
    return buf;
}

function amf3decFalse() {
    return {len: 1, value: false}
}

function amf3encFalse() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x02);
    return buf;
}

function amf3decTrue() {
    return {len: 1, value: true}
}

function amf3encTrue() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x03);
    return buf;
}

function amf3decUI29(buf) {
    let val = 0;
    let len = 1;
    let b;
    do {
        b = buf.readUInt8(len++);
        val = (val << 7) + (b & 0x7F);
    } while (len < 5 || b > 0x7F);
    if (len == 5) val = val | b;
    return {len: len, value: val}
}

function amf3encUI29(num) {
    let len = 0;
    if (num < 0x80) len = 1;
    if (num < 0x4000) len = 2;
    if (num < 0x200000) len = 3;
    if (num >= 0x200000) len = 4;
    let buf = Buffer.alloc(len);
    switch (len) {
        case 1:
            buf.writeUInt8(num, 0);
            break;
        case 2:
            buf.writeUInt8(num & 0x7F, 0);
            buf.writeUInt8((num >> 7) | 0x80, 1);
            break;
        case 3:
            buf.writeUInt8(num & 0x7F, 0);
            buf.writeUInt8((num >> 7) & 0x7F, 1);
            buf.writeUInt8((num >> 14) | 0x80, 2);
            break;
        case 4:
            buf.writeUInt8(num & 0xFF, 0);
            buf.writeUInt8((num >> 8) & 0x7F, 1);
            buf.writeUInt8((num >> 15) | 0x7F, 2);
            buf.writeUInt8((num >> 22) | 0x7F, 3);
            break;
    }
    return buf;
}

function amf3decInteger(buf) {
    let resp = amf3decUI29(buf);
    if (resp.value > 0x0FFFFFFF) resp.value = (resp.value & 0x0FFFFFFF) - 0x10000000;
    return resp;
}

function amf3encInteger(num) {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x4, 0);
    return Buffer.concat([buf, amf3encUI29(num & 0x3FFFFFFF)]);
}

function amf3decString(buf) {
    let sLen = amf3decUI29(buf);
    let s = sLen & 1;
    sLen = sLen >> 1;
    if (s) return {len: sLen.value + 5, value: buf.slice(5, sLen.value + 5).toString('utf8')};
    throw new Error("Error, we have a need to decode a String that is a Reference");
}

function amf3encString(str) {
    let sLen = amf3encUI29(str.length << 1);
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x6, 0);
    return Buffer.concat([buf, sLen, Buffer.from(str, 'utf8')]);
}

function amf3decXmlDoc(buf) {
    let sLen = amf3decUI29(buf);
    let s = sLen & 1;
    sLen = sLen >> 1;
    if (s) return {len: sLen.value + 5, value: buf.slice(5, sLen.value + 5).toString('utf8')};
    throw new Error("Error, we have a need to decode a String that is a Reference");
}

function amf3encXmlDoc(str) {
    let sLen = amf3encUI29(str.length << 1);
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x7, 0);
    return Buffer.concat([buf, sLen, Buffer.from(str, 'utf8')]);
}

function amf3decXml(buf) {
    let sLen = amf3decUI29(buf);
    let s = sLen & 1;
    sLen = sLen >> 1;
    if (s) return {len: sLen.value + 5, value: buf.slice(5, sLen.value + 5).toString('utf8')};
    throw new Error("Error, we have a need to decode a String that is a Reference");
}

function amf3encXml(str) {
    let sLen = amf3encUI29(str.length << 1);
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x0B, 0);
    return Buffer.concat([buf, sLen, Buffer.from(str, 'utf8')]);
}

function amf3decByteArray(buf) {
    let sLen = amf3decUI29(buf);
    let s = sLen & 1;
    sLen = sLen >> 1;
    if (s) return {len: sLen.value + 5, value: buf.slice(5, sLen.value + 5)};
    throw new Error("Error, we have a need to decode a String that is a Reference");
}

function amf3encByteArray(str) {
    let sLen = amf3encUI29(str.length << 1);
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x0C, 0);
    return Buffer.concat([buf, sLen, (typeof str == 'string') ? Buffer.from(str, 'binary') : str]);
}

function amf3decDouble(buf) {
    return {len: 9, value: buf.readDoubleBE(1)}
}

function amf3encDouble(num) {
    let buf = Buffer.alloc(9);
    buf.writeUInt8(0x05, 0);
    buf.writeDoubleBE(num, 1);
    return buf;
}

function amf3decDate(buf) {
    let uTz = amf3decUI29(buf);
    let ts = buf.readDoubleBE(uTz.len);
    return {len: uTz.len + 8, value: ts}
}

function amf3encDate(ts) {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x8, 0);
    let tsBuf = Buffer.alloc(8);
    tsBuf.writeDoubleBE(ts, 0);
    return Buffer.concat([buf, amf3encUI29(1), tsBuf]);
}

function amf3decArray(buf) {
    let count = amf3decUI29(buf.slice(1));
    let obj = amf3decObject(buf.slice(count.len));
    if (count.value % 2 == 1) throw new Error("This is a reference to another array, which currently we don't support!");
    return {len: count.len + obj.len, value: obj.value}
}

function amf3encArray() {
    throw new Error('Encoding arrays is not supported yet!');
}

function amf3decObject(buf) {
    let obj = {};
    return obj;
}

function amf3encObject(o) {
}

function amf0decNumber(buf) {
    return {len: 9, value: buf.readDoubleBE(1)}
}

function amf0encNumber(num) {
    let buf = Buffer.alloc(9);
    buf.writeUInt8(0x00, 0);
    buf.writeDoubleBE(num, 1);
    return buf;
}

function amf0decBool(buf) {
    return {len: 2, value: (buf.readUInt8(1) != 0)}
}

function amf0encBool(num) {
    let buf = Buffer.alloc(2);
    buf.writeUInt8(0x01, 0);
    buf.writeUInt8((num ? 1 : 0), 1);
    return buf;
}

function amf0decNull() {
    return {len: 1, value: null}
}

function amf0encNull() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x05, 0);
    return buf;
}

function amf0decUndefined() {
    return {len: 1, value: undefined}
}

function amf0encUndefined() {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x06, 0);
    return buf;
}

function amf0decDate(buf) {
    let ts = buf.readDoubleBE(3);
    return {len: 11, value: ts}
}

function amf0encDate(ts) {
    let buf = Buffer.alloc(11);
    buf.writeUInt8(0x0B, 0);
    buf.writeInt16BE(0, 1);
    buf.writeDoubleBE(ts, 3);
    return buf;
}

function amf0decObject(buf) {
    let obj = {};
    let iBuf = buf.slice(1);
    let len = 1;
    while (iBuf.readUInt8(0) != 0x09) {
        let prop = amf0decUString(iBuf);
        len += prop.len;
        if (iBuf.length < prop.len) {
            break;
        }
        if (iBuf.slice(prop.len).readUInt8(0) == 0x09) {
            len++;
            break;
        }
        if (prop.value == '') break;
        let val = amf0DecodeOne(iBuf.slice(prop.len));
        obj[prop.value] = val.value;
        len += val.len;
        iBuf = iBuf.slice(prop.len + val.len);
    }
    return {len: len, value: obj}
}

function amf0encObject(o) {
    if (typeof o !== 'object') return;
    let data = Buffer.alloc(1);
    data.writeUInt8(0x03, 0);
    let k;
    for (k in o) {
        data = Buffer.concat([data, amf0encUString(k), amf0EncodeOne(o[k])]);
    }
    let termCode = Buffer.alloc(1);
    termCode.writeUInt8(0x09, 0);
    return Buffer.concat([data, amf0encUString(''), termCode]);
}

function amf0decRef(buf) {
    let index = buf.readUInt16BE(1);
    return {len: 3, value: 'ref' + index}
}

function amf0encRef(index) {
    let buf = Buffer.alloc(3);
    buf.writeUInt8(0x07, 0);
    buf.writeUInt16BE(index, 1);
    return buf;
}

function amf0decString(buf) {
    let sLen = buf.readUInt16BE(1);
    return {len: 3 + sLen, value: buf.toString('utf8', 3, 3 + sLen)}
}

function amf0decUString(buf) {
    let sLen = buf.readUInt16BE(0);
    return {len: 2 + sLen, value: buf.toString('utf8', 2, 2 + sLen)}
}

function amf0encUString(str) {
    let data = Buffer.from(str, 'utf8');
    let sLen = Buffer.alloc(2);
    sLen.writeUInt16BE(data.length, 0);
    return Buffer.concat([sLen, data]);
}

function amf0encString(str) {
    let buf = Buffer.alloc(3);
    buf.writeUInt8(0x02, 0);
    buf.writeUInt16BE(str.length, 1);
    return Buffer.concat([buf, Buffer.from(str, 'utf8')]);
}

function amf0decLongString(buf) {
    let sLen = buf.readUInt32BE(1);
    return {len: 5 + sLen, value: buf.toString('utf8', 5, 5 + sLen)}
}

function amf0encLongString(str) {
    let buf = Buffer.alloc(5);
    buf.writeUInt8(0x0C, 0);
    buf.writeUInt32BE(str.length, 1);
    return Buffer.concat([buf, Buffer.from(str, 'utf8')]);
}

function amf0decArray(buf) {
    let obj = amf0decObject(buf.slice(4));
    return {len: 5 + obj.len, value: obj.value}
}

function amf0encArray(a) {
    let l = 0;
    if (a instanceof Array) l = a.length; else l = Object.keys(a).length;
    console.debug('Array encode', l, a);
    let buf = Buffer.alloc(5);
    buf.writeUInt8(8, 0);
    buf.writeUInt32BE(l, 1);
    let data = amf0encObject(a);
    return Buffer.concat([buf, data.slice(1)]);
}

function amf0cnletray2Object(aData) {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(0x3, 0);
    return Buffer.concat([buf, aData.slice(5)]);
}

function amf0cnvObject2Array(oData) {
    let buf = Buffer.alloc(5);
    let o = amf0decObject(oData);
    let l = Object.keys(o).length;
    buf.writeUInt32BE(l, 1);
    return Buffer.concat([buf, oData.slice(1)]);
}

function amf0decXmlDoc(buf) {
    let sLen = buf.readUInt16BE(1);
    return {len: 3 + sLen, value: buf.toString('utf8', 3, 3 + sLen)}
}

function amf0encXmlDoc(str) {
    let buf = Buffer.alloc(3);
    buf.writeUInt8(0x0F, 0);
    buf.writeUInt16BE(str.length, 1);
    return Buffer.concat([buf, Buffer.from(str, 'utf8')]);
}

function amf0decSArray(buf) {
    let a = [];
    let len = 5;
    let ret;
    for (let count = buf.readUInt32BE(1); count; count--) {
        ret = amf0DecodeOne(buf.slice(len));
        a.push(ret.value);
        len += ret.len;
    }
    return {len: len, value: amf0markSArray(a)}
}

function amf0encSArray(a) {
    console.debug('Do strict array!');
    let buf = Buffer.alloc(5);
    buf.writeUInt8(0x0A, 0);
    buf.writeUInt32BE(a.length, 1);
    let i;
    for (i = 0; i < a.length; i++) {
        buf = Buffer.concat([buf, amf0EncodeOne(a[i])]);
    }
    return buf;
}

function amf0markSArray(a) {
    Object.defineProperty(a, 'sarray', {value: true});
    return a;
}

function amf0decTypedObj(buf) {
    let className = amf0decString(buf);
    let obj = amf0decObject(buf.slice(className.len - 1));
    obj.value.__className__ = className.value;
    return {len: className.len + obj.len - 1, value: obj.value}
}

function amf0decSwitchAmf3(buf) {
    let r = amf3DecodeOne(buf.slice(1));
    return r;
}

function amf0encTypedObj() {
    throw new Error("Error: SArray encoding is not yet implemented!");
}

function amfXDecodeOne(rules, buffer) {
    if (!rules[buffer.readUInt8(0)]) {
        console.error('Unknown field', buffer.readUInt8(0));
        return null;
    }
    return rules[buffer.readUInt8(0)](buffer);
}

function amf0DecodeOne(buffer) {
    return amfXDecodeOne(amf0dRules, buffer);
}

function amf3DecodeOne(buffer) {
    return amfXDecodeOne(amf3dRules, buffer);
}

function amfXDecode(rules, buffer) {
    let resp = [];
    let res;
    for (let i = 0; i < buffer.length;) {
        res = amfXDecodeOne(rules, buffer.slice(i));
        i += res.len;
        resp.push(res.value);
    }
    return resp;
}

function amf3Decode(buffer) {
    return amfXDecode(amf3dRules, buffer);
}

function amf0Decode(buffer) {
    return amfXDecode(amf0dRules, buffer);
}

function amfXEncodeOne(rules, o) {
    let f = rules[amfType(o)];
    if (f) return f(o);
    throw new Error('Unsupported type for encoding!');
}

function amf0EncodeOne(o) {
    return amfXEncodeOne(amf0eRules, o);
}

function amf3EncodeOne(o) {
    return amfXEncodeOne(amf3eRules, o);
}

function amf3Encode(a) {
    let buf = Buffer.alloc(0);
    a.forEach(function (o) {
        buf = Buffer.concat([buf, amf3EncodeOne(o)]);
    });
    return buf;
}

function amf0Encode(a) {
    let buf = Buffer.alloc(0);
    a.forEach(function (o) {
        buf = Buffer.concat([buf, amf0EncodeOne(o)]);
    });
    return buf;
}

const rtmpCmdCode = {
    "_result": ["transId", "cmdObj", "info"],
    "_error": ["transId", "cmdObj", "info", "streamId"],
    "onStatus": ["transId", "cmdObj", "info"],
    "releaseStream": ["transId", "cmdObj", "streamName"],
    "getStreamLength": ["transId", "cmdObj", "streamId"],
    "getMovLen": ["transId", "cmdObj", "streamId"],
    "FCPublish": ["transId", "cmdObj", "streamName"],
    "FCUnpublish": ["transId", "cmdObj", "streamName"],
    "FCSubscribe": ["transId", "cmdObj", "streamName"],
    "onFCPublish": ["transId", "cmdObj", "info"],
    "connect": ["transId", "cmdObj", "args"],
    "call": ["transId", "cmdObj", "args"],
    "createStream": ["transId", "cmdObj"],
    "close": ["transId", "cmdObj"],
    "play": ["transId", "cmdObj", "streamName", "start", "duration", "reset"],
    "play2": ["transId", "cmdObj", "params"],
    "deleteStream": ["transId", "cmdObj", "streamId"],
    "closeStream": ["transId", "cmdObj"],
    "receiveAudio": ["transId", "cmdObj", "bool"],
    "receiveVideo": ["transId", "cmdObj", "bool"],
    "publish": ["transId", "cmdObj", "streamName", "type"],
    "seek": ["transId", "cmdObj", "ms"],
    "pause": ["transId", "cmdObj", "pause", "ms"]
};
const rtmpDataCode = {
    "@setDataFrame": ["method", "dataObj"],
    "onFI": ["info"],
    "onMetaData": ["dataObj"],
    "|RtmpSampleAccess": ["bool1", "bool2"],
};

function decodeAmf0Data(dbuf) {
    let buffer = dbuf;
    let resp = {};
    let cmd = amf0DecodeOne(buffer);
    if (cmd) {
        resp.cmd = cmd.value;
        buffer = buffer.slice(cmd.len);
        if (rtmpDataCode[cmd.value]) {
            rtmpDataCode[cmd.value].forEach(function (n) {
                if (buffer.length > 0) {
                    let r = amf0DecodeOne(buffer);
                    if (r) {
                        buffer = buffer.slice(r.len);
                        resp[n] = r.value;
                    }
                }
            });
        } else {
            console.error('Unknown command', resp);
        }
    }
    return resp
}

function decodeAMF0Cmd(dbuf) {
    let buffer = dbuf;
    let resp = {};
    let cmd = amf0DecodeOne(buffer);
    resp.cmd = cmd.value;
    buffer = buffer.slice(cmd.len);
    if (rtmpCmdCode[cmd.value]) {
        rtmpCmdCode[cmd.value].forEach(function (n) {
            if (buffer.length > 0) {
                let r = amf0DecodeOne(buffer);
                buffer = buffer.slice(r.len);
                resp[n] = r.value;
            }
        });
    } else {
        console.error('Unknown command', resp);
    }
    return resp
}

function encodeAMF0Cmd(opt) {
    let data = amf0EncodeOne(opt.cmd);
    if (rtmpCmdCode[opt.cmd]) {
        rtmpCmdCode[opt.cmd].forEach(function (n) {
            if (opt.hasOwnProperty(n))
                data = Buffer.concat([data, amf0EncodeOne(opt[n])]);
        });
    } else {
        console.error('Unknown command', opt);
    }
    return data
}

function encodeAMF0Data(opt) {
    let data = amf0EncodeOne(opt.cmd);
    if (rtmpDataCode[opt.cmd]) {
        rtmpDataCode[opt.cmd].forEach(function (n) {
            if (opt.hasOwnProperty(n))
                data = Buffer.concat([data, amf0EncodeOne(opt[n])]);
        });
    } else {
        console.error('Unknown data', opt);
    }
    return data
}

function decodeAMF3Cmd(dbuf) {
    let buffer = dbuf;
    let resp = {};
    let cmd = amf3DecodeOne(buffer);
    resp.cmd = cmd.value;
    buffer = buffer.slice(cmd.len);
    if (rtmpCmdCode[cmd.value]) {
        rtmpCmdCode[cmd.value].forEach(function (n) {
            if (buffer.length > 0) {
                let r = amf3DecodeOne(buffer);
                buffer = buffer.slice(r.len);
                resp[n] = r.value;
            }
        });
    } else {
        console.error('Unknown command', resp);
    }
    return resp
}

function encodeAMF3Cmd(opt) {
    let data = amf0EncodeOne(opt.cmd);
    if (rtmpCmdCode[opt.cmd]) {
        rtmpCmdCode[opt.cmd].forEach(function (n) {
            if (opt.hasOwnProperty(n))
                data = Buffer.concat([data, amf3EncodeOne(opt[n])]);
        });
    } else {
        console.error('Unknown command', opt);
    }
    return data
}

var core_amf = {
    decodeAmf3Cmd: decodeAMF3Cmd,
    encodeAmf3Cmd: encodeAMF3Cmd,
    decodeAmf0Cmd: decodeAMF0Cmd,
    encodeAmf0Cmd: encodeAMF0Cmd,
    decodeAmf0Data: decodeAmf0Data,
    encodeAmf0Data: encodeAMF0Data,
    amfType: amfType,
    amf0Encode: amf0Encode,
    amf0EncodeOne: amf0EncodeOne,
    amf0Decode: amf0Decode,
    amf0DecodeOne: amf0DecodeOne,
    amf3Encode: amf3Encode,
    amf3EncodeOne: amf3EncodeOne,
    amf3Decode: amf3Decode,
    amf3DecodeOne: amf3DecodeOne,
    amf0cnvA2O: amf0cnletray2Object,
    amf0cnvO2A: amf0cnvObject2Array,
    amf0markSArray: amf0markSArray,
    amf0decArray: amf0decArray,
    amf0decBool: amf0decBool,
    amf0decDate: amf0decDate,
    amf0decLongString: amf0decLongString,
    amf0decNull: amf0decNull,
    amf0decNumber: amf0decNumber,
    amf0decObject: amf0decObject,
    amf0decRef: amf0decRef,
    amf0decSArray: amf0decSArray,
    amf0decString: amf0decString,
    amf0decTypedObj: amf0decTypedObj,
    amf0decUndefined: amf0decUndefined,
    amf0decXmlDoc: amf0decXmlDoc,
    amf0encArray: amf0encArray,
    amf0encBool: amf0encBool,
    amf0encDate: amf0encDate,
    amf0encLongString: amf0encLongString,
    amf0encNull: amf0encNull,
    amf0encNumber: amf0encNumber,
    amf0encObject: amf0encObject,
    amf0encRef: amf0encRef,
    amf0encSArray: amf0encSArray,
    amf0encString: amf0encString,
    amf0encTypedObj: amf0encTypedObj,
    amf0encUndefined: amf0encUndefined,
    amf0encXmlDoc: amf0encXmlDoc,
    amf3decArray: amf3decArray,
    amf3decByteArray: amf3decByteArray,
    amf3decDate: amf3decDate,
    amf3decDouble: amf3decDouble,
    amf3decFalse: amf3decFalse,
    amf3decInteger: amf3decInteger,
    amf3decNull: amf3decNull,
    amf3decObject: amf3decObject,
    amf3decString: amf3decString,
    amf3decTrue: amf3decTrue,
    amf3decUI29: amf3decUI29,
    amf3decUndefined: amf3decUndefined,
    amf3decXml: amf3decXml,
    amf3decXmlDoc: amf3decXmlDoc,
    amf3encArray: amf3encArray,
    amf3encByteArray: amf3encByteArray,
    amf3encDate: amf3encDate,
    amf3encDouble: amf3encDouble,
    amf3encFalse: amf3encFalse,
    amf3encInteger: amf3encInteger,
    amf3encNull: amf3encNull,
    amf3encObject: amf3encObject,
    amf3encString: amf3encString,
    amf3encTrue: amf3encTrue,
    amf3encUI29: amf3encUI29,
    amf3encUndefined: amf3encUndefined,
    amf3encXml: amf3encXml,
    amf3encXmlDoc: amf3encXmlDoc
};

const MESSAGE_FORMAT_0 = 0;
const MESSAGE_FORMAT_1 = 1;
const MESSAGE_FORMAT_2 = 2;
const RTMP_SIG_SIZE = 1536;
const SHA256DL = 32;
const RandomCrud = Buffer.from([
    0xf0, 0xee, 0xc2, 0x4a, 0x80, 0x68, 0xbe, 0xe8,
    0x2e, 0x00, 0xd0, 0xd1, 0x02, 0x9e, 0x7e, 0x57,
    0x6e, 0xec, 0x5d, 0x2d, 0x29, 0x80, 0x6f, 0xab,
    0x93, 0xb8, 0xe6, 0x36, 0xcf, 0xeb, 0x31, 0xae
]);
const GenuineFMSConst = 'Genuine Adobe Flash Media Server 001';
const GenuineFMSConstCrud = Buffer.concat([Buffer.from(GenuineFMSConst, 'utf8'), RandomCrud]);
const GenuineFPConst = 'Genuine Adobe Flash Player 001';
const GenuineFPConstCrud = Buffer.concat([Buffer.from(GenuineFPConst, 'utf8'), RandomCrud]);

function calcHmac(data, key) {
    let hmac = crypto__default['default'].createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest();
}

function GetClientGenuineConstDigestOffset(buf) {
    let offset = buf[0] + buf[1] + buf[2] + buf[3];
    offset = (offset % 728) + 12;
    return offset;
}

function GetServerGenuineConstDigestOffset(buf) {
    let offset = buf[0] + buf[1] + buf[2] + buf[3];
    offset = (offset % 728) + 776;
    return offset;
}

function detectClientMessageFormat(clientsig) {
    let computedSignature, msg, providedSignature, sdl;
    sdl = GetServerGenuineConstDigestOffset(clientsig.slice(772, 776));
    msg = Buffer.concat([clientsig.slice(0, sdl), clientsig.slice(sdl + SHA256DL)], 1504);
    computedSignature = calcHmac(msg, GenuineFPConst);
    providedSignature = clientsig.slice(sdl, sdl + SHA256DL);
    if (computedSignature.equals(providedSignature)) {
        return MESSAGE_FORMAT_2;
    }
    sdl = GetClientGenuineConstDigestOffset(clientsig.slice(8, 12));
    msg = Buffer.concat([clientsig.slice(0, sdl), clientsig.slice(sdl + SHA256DL)], 1504);
    computedSignature = calcHmac(msg, GenuineFPConst);
    providedSignature = clientsig.slice(sdl, sdl + SHA256DL);
    if (computedSignature.equals(providedSignature)) {
        return MESSAGE_FORMAT_1;
    }
    return MESSAGE_FORMAT_0;
}

function generateS1(messageFormat) {
    let randomBytes = crypto__default['default'].randomBytes(RTMP_SIG_SIZE - 8);
    let handshakeBytes = Buffer.concat([Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]), randomBytes], RTMP_SIG_SIZE);
    let serverDigestOffset;
    if (messageFormat === 1) {
        serverDigestOffset = GetClientGenuineConstDigestOffset(handshakeBytes.slice(8, 12));
    } else {
        serverDigestOffset = GetServerGenuineConstDigestOffset(handshakeBytes.slice(772, 776));
    }
    msg = Buffer.concat([handshakeBytes.slice(0, serverDigestOffset), handshakeBytes.slice(serverDigestOffset + SHA256DL)], RTMP_SIG_SIZE - SHA256DL);
    hash = calcHmac(msg, GenuineFMSConst);
    hash.copy(handshakeBytes, serverDigestOffset, 0, 32);
    return handshakeBytes;
}

function generateS2(messageFormat, clientsig, callback) {
    let randomBytes = crypto__default['default'].randomBytes(RTMP_SIG_SIZE - 32);
    let challengeKeyOffset;
    if (messageFormat === 1) {
        challengeKeyOffset = GetClientGenuineConstDigestOffset(clientsig.slice(8, 12));
    } else {
        challengeKeyOffset = GetServerGenuineConstDigestOffset(clientsig.slice(772, 776));
    }
    let challengeKey = clientsig.slice(challengeKeyOffset, challengeKeyOffset + 32);
    let hash = calcHmac(challengeKey, GenuineFMSConstCrud);
    let signature = calcHmac(randomBytes, hash);
    let s2Bytes = Buffer.concat([randomBytes, signature], RTMP_SIG_SIZE);
    return s2Bytes
}

function generateS0S1S2(clientsig) {
    let clientType = Buffer.alloc(1, 3);
    let messageFormat = detectClientMessageFormat(clientsig);
    let allBytes;
    if (messageFormat === MESSAGE_FORMAT_0) {
        allBytes = Buffer.concat([clientType, clientsig, clientsig]);
    } else {
        allBytes = Buffer.concat([clientType, generateS1(messageFormat), generateS2(messageFormat, clientsig)]);
    }
    return allBytes;
}

var handshake = {generateS0S1S2};

const {ConsoleLogger: ConsoleLogger$2} = logger;
const {EventHandler: EventHandler$1, InternalEventHandler: InternalEventHandler$3, FlvSessionEvents: FlvSessionEvents$1} = events;
const Logger$1 = new ConsoleLogger$2();
const FlvPacket = {
    create: (payload = null, type = 0, time = 0) => {
        return {
            header: {
                length: payload ? payload.length : 0,
                timestamp: time,
                type: type
            },
            payload: payload
        };
    }
};

class FlvSession extends InternalEventHandler$3 {
    constructor(req, res) {
        super();
        this.req = req;
        this.res = res;
        this.id = core_utils.generateNewSessionID();
        this.ip = this.req.socket.remoteAddress;
        this.playStreamPath = "";
        this.playArgs = null;
        this.isStarting = false;
        this.isPlaying = false;
        this.isIdling = false;
        if (this.req.nmsConnectionType === "ws") {
            this.res.cork = this.res._socket.cork.bind(this.res._socket);
            this.res.uncork = this.res._socket.uncork.bind(this.res._socket);
            this.res.on("close", this.onReqClose.bind(this));
            this.res.on("error", this.onReqError.bind(this));
            this.res.write = this.res.send;
            this.res.end = this.res.close;
            this.TAG = "websocket-flv";
        } else {
            this.res.cork = this.res.socket.cork.bind(this.res.socket);
            this.res.uncork = this.res.socket.uncork.bind(this.res.socket);
            this.req.socket.on("close", this.onReqClose.bind(this));
            this.req.on("error", this.onReqError.bind(this));
            this.TAG = "http-flv";
        }
        this.numPlayCache = 0;
        core_ctx.sessions.set(this.id, this);
    }

    run() {
        let method = this.req.method;
        let urlInfo = url__default['default'].parse(this.req.url, true);
        let streamPath = urlInfo.pathname.split(".")[0];
        this.connectCmdObj = {ip: this.ip, method, streamPath, query: urlInfo.query};
        this.connectTime = new Date();
        this.isStarting = true;
        console.log(`[${this.TAG} connect] id=${this.id} ip=${this.ip} url=${this.req.url} streamPath=${streamPath.replace(/^\//gmi, "")}`);
        this.emit(FlvSessionEvents$1.PreConnect, this.id, this.connectCmdObj);
        if (!this.isStarting) {
            this.stop();
            return;
        }
        this.emit(FlvSessionEvents$1.PostConnect, this.id, this.connectCmdObj);
        try {
            if (method === "GET") {
                this.playStreamPath = streamPath.replace("/", "");
                this.playArgs = urlInfo.query;
                this.onPlay();
            } else {
                this.stop();
            }
        } catch (e) {
            console.error(e);
        }
    }

    stop() {
        if (this.isStarting) {
            this.isStarting = false;
            let publisherId = core_ctx.publishers.getName(this.playStreamPath);
            if (publisherId != null) {
                core_ctx.sessions.get(publisherId).players.delete(this.id);
                this.emit(FlvSessionEvents$1.DonePlay, this.id, this.playStreamPath, this.playArgs);
            }
            Logger$1.log(`[${this.TAG} play] Close stream. id=${this.id} streamPath=${this.playStreamPath}`);
            Logger$1.log(`[${this.TAG} disconnect] id=${this.id}`);
            this.emit(FlvSessionEvents$1.DoneConnect, this.id, this.connectCmdObj);
            this.res.end();
            core_ctx.idlePlayers.delete(this.id);
            core_ctx.sessions.delete(this.id);
        }
    }

    onReqClose() {
        this.stop();
    }

    onReqError(e) {
        console.error(e);
        this.stop();
    }

    reject() {
        Logger$1.log(`[${this.TAG} reject] id=${this.id}`);
        this.stop();
    }

    onPlay() {
        this.emit(FlvSessionEvents$1.PrePlay, this.id, this.playStreamPath, this.playArgs);
        if (!this.isStarting) {
            return;
        }
        if (!core_ctx.publishers.hasName(this.playStreamPath)) {
            Logger$1.log(`[${this.TAG} play] Stream not found. id=${this.id} streamPath=${this.playStreamPath} `);
            core_ctx.idlePlayers.add(this.id);
            this.isIdling = true;
            return;
        }
        this.onStartPlay();
    }

    onStartPlay() {
        let publisherId = core_ctx.publishers.getName(this.playStreamPath);
        let publisher = core_ctx.sessions.get(publisherId);
        let players = publisher.players;
        players.add(this.id);
        let FLVHeader = Buffer.from([0x46, 0x4c, 0x56, 0x01, 0x00, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00]);
        if (publisher.isFirstAudioReceived) {
            FLVHeader[4] |= 0b00000100;
        }
        if (publisher.isFirstVideoReceived) {
            FLVHeader[4] |= 0b00000001;
        }
        this.res.write(FLVHeader);
        if (publisher.metaData != null) {
            let packet = FlvPacket.create(publisher.metaData, 18);
            let tag = FlvSession.createFlvTag(packet);
            this.res.write(tag);
        }
        if (publisher.audioCodec == 10) {
            let packet = FlvPacket.create(publisher.aacSequenceHeader, 8);
            let tag = FlvSession.createFlvTag(packet);
            this.res.write(tag);
        }
        if (publisher.videoCodec == 7 || publisher.videoCodec == 12) {
            let packet = FlvPacket.create(publisher.avcSequenceHeader, 9);
            let tag = FlvSession.createFlvTag(packet);
            this.res.write(tag);
        }
        if (publisher.flvGopCacheQueue != null) {
            for (let tag of publisher.flvGopCacheQueue) {
                this.res.write(tag);
            }
        }
        this.isIdling = false;
        this.isPlaying = true;
        Logger$1.log(`[${this.TAG} play] Join stream. id=${this.id} streamPath=${this.playStreamPath} `);
        this.emit(FlvSessionEvents$1.PostPlay, this.id, this.playStreamPath, this.playArgs);
    }

    static createFlvTag(packet) {
        let PreviousTagSize = 11 + packet.header.length;
        let tagBuffer = Buffer.alloc(PreviousTagSize + 4);
        tagBuffer[0] = packet.header.type;
        tagBuffer.writeUIntBE(packet.header.length, 1, 3);
        tagBuffer[4] = (packet.header.timestamp >> 16) & 0xff;
        tagBuffer[5] = (packet.header.timestamp >> 8) & 0xff;
        tagBuffer[6] = packet.header.timestamp & 0xff;
        tagBuffer[7] = (packet.header.timestamp >> 24) & 0xff;
        tagBuffer.writeUIntBE(0, 8, 3);
        tagBuffer.writeUInt32BE(PreviousTagSize, PreviousTagSize);
        packet.payload.copy(tagBuffer, 11, 0, packet.header.length);
        return tagBuffer;
    }
}

var flv_session = FlvSession;

const {AUDIO_SOUND_RATE: AUDIO_SOUND_RATE$1, AUDIO_CODEC_NAME: AUDIO_CODEC_NAME$1, VIDEO_CODEC_NAME: VIDEO_CODEC_NAME$1} = core_av;
const {EventHandler: EventHandler$2, InternalEventHandler: InternalEventHandler$4, Event: Event$3, EventItem: EventItem$3, EventsCache: EventsCache$3} = event_handler;
const {RtmpRelayEvents: RtmpRelayEvents$2, RtmpServerEvents: RtmpServerEvents$2, RtmpSessionEvents: RtmpSessionEvents$2, FFmpegEvents: FFmpegEvents$2} = events;
const {ConsoleLogger: ConsoleLogger$3, LogLevel: LogLevel$2} = logger;
const Logger$2 = new ConsoleLogger$3("RTMP_SESSION");
const RTMP_HANDSHAKE_SIZE = 1536;
const RTMP_HANDSHAKE_UNINIT = 0;
const RTMP_HANDSHAKE_0 = 1;
const RTMP_HANDSHAKE_1 = 2;
const RTMP_HANDSHAKE_2 = 3;
const RTMP_PARSE_INIT = 0;
const RTMP_PARSE_BASIC_HEADER = 1;
const RTMP_PARSE_MESSAGE_HEADER = 2;
const RTMP_PARSE_EXTENDED_TIMESTAMP = 3;
const RTMP_PARSE_PAYLOAD = 4;
const MAX_CHUNK_HEADER = 18;
const RTMP_CHUNK_TYPE_0 = 0;
const RTMP_CHUNK_TYPE_1 = 1;
const RTMP_CHUNK_TYPE_2 = 2;
const RTMP_CHUNK_TYPE_3 = 3;
const RTMP_CHANNEL_PROTOCOL = 2;
const RTMP_CHANNEL_INVOKE = 3;
const RTMP_CHANNEL_AUDIO = 4;
const RTMP_CHANNEL_VIDEO = 5;
const RTMP_CHANNEL_DATA = 6;
const rtmpHeaderSize = [11, 7, 3, 0];
const RTMP_TYPE_SET_CHUNK_SIZE = 1;
const RTMP_TYPE_ABORT = 2;
const RTMP_TYPE_ACKNOWLEDGEMENT = 3;
const RTMP_TYPE_WINDOW_ACKNOWLEDGEMENT_SIZE = 5;
const RTMP_TYPE_SET_PEER_BANDWIDTH = 6;
const RTMP_TYPE_EVENT = 4;
const RTMP_TYPE_AUDIO = 8;
const RTMP_TYPE_VIDEO = 9;
const RTMP_TYPE_FLEX_STREAM = 15;
const RTMP_TYPE_DATA = 18;
const RTMP_TYPE_FLEX_MESSAGE = 17;
const RTMP_TYPE_INVOKE = 20;
const RTMP_TYPE_METADATA = 22;
const RTMP_CHUNK_SIZE = 128;
const RTMP_PING_TIME = 60000;
const RTMP_PING_TIMEOUT = 30000;
const STREAM_BEGIN = 0x00;
const STREAM_EOF = 0x01;
const RtmpPacket = {
    create: (fmt = 0, cid = 0) => {
        return {
            header: {
                fmt: fmt,
                cid: cid,
                timestamp: 0,
                length: 0,
                type: 0,
                stream_id: 0
            },
            clock: 0,
            payload: null,
            capacity: 0,
            bytes: 0
        };
    }
};

function isPrimitiveType(value) {
    switch (typeof value) {
        case "number":
        case "string":
        case "boolean":
            return true;
        default:
            return false;
    }
}

class RtmpSession extends InternalEventHandler$4 {
    constructor(config, socket) {
        super();
        this.config = config;
        this.socket = socket;
        this.res = socket;
        this.id = core_utils.generateNewSessionID();
        this.ip = socket.remoteAddress;
        this.TAG = "rtmp";
        Logger$2.level = config.rtmpSession.logLevel;
        this.pushAllowType = config.rtmpSession.allowPush;
        this.pullAllowType = config.rtmpSession.allowPull;
        this.handshakePayload = Buffer.alloc(RTMP_HANDSHAKE_SIZE);
        this.handshakeState = RTMP_HANDSHAKE_UNINIT;
        this.handshakeBytes = 0;
        this.parserBuffer = Buffer.alloc(MAX_CHUNK_HEADER);
        this.parserState = RTMP_PARSE_INIT;
        this.parserBytes = 0;
        this.parserBasicBytes = 0;
        this.parserPacket = null;
        this.inPackets = new Map();
        this.inChunkSize = RTMP_CHUNK_SIZE;
        this.outChunkSize = config.rtmp.chunk_size ? config.rtmp.chunk_size : RTMP_CHUNK_SIZE;
        this.pingTime = config.rtmp.ping ? config.rtmp.ping * 1000 : RTMP_PING_TIME;
        this.pingTimeout = config.rtmp.ping_timeout ? config.rtmp.ping_timeout * 1000 : RTMP_PING_TIMEOUT;
        this.pingInterval = null;
        this.isLocal = this.ip === "127.0.0.1" || this.ip === "::1" || this.ip == "::ffff:127.0.0.1";
        this.isStarting = false;
        this.isPublishing = false;
        this.isPlaying = false;
        this.isIdling = false;
        this.isPause = false;
        this.isReceiveAudio = true;
        this.isReceiveVideo = true;
        this.metaData = null;
        this.aacSequenceHeader = null;
        this.avcSequenceHeader = null;
        this.audioCodec = 0;
        this.audioCodecName = "";
        this.audioProfileName = "";
        this.audioSamplerate = 0;
        this.audioChannels = 1;
        this.videoCodec = 0;
        this.videoCodecName = "";
        this.videoProfileName = "";
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.videoFps = 0;
        this.videoLevel = 0;
        this.gopCacheEnable = config.rtmp.gop_cache;
        this.rtmpGopCacheQueue = null;
        this.flvGopCacheQueue = null;
        this.ackSize = 0;
        this.inAckSize = 0;
        this.inLastAck = 0;
        this.appname = "";
        this.appInfo = {
            app: "",
            name: "",
            query: []
        };
        this.streams = 0;
        this.playStreamId = 0;
        this.playStreamPath = "";
        this.playArgs = {};
        this.publishStreamId = 0;
        this.publishStreamPath = "";
        this.publishArgs = {};
        this.players = new Set();
        this.numPlayCache = 0;
        core_ctx.sessions.set(this.id, this);
    }

    get name() {
        this.appInfo.name;
    }

    get sessionInfo() {
        const ignore = ["ip"];
        let sessionData = {input: this.appInfo};
        for (let key in this) {
            if (this.hasOwnProperty(key) && isPrimitiveType(this[key])) {
                if (ignore.includes(key)) continue;
                sessionData[key] = this[key];
            }
        }
        return sessionData;
    }

    run() {
        this.socket.on("data", this.onSocketData.bind(this));
        this.socket.on("close", this.onSocketClose.bind(this));
        this.socket.on("error", this.onSocketError.bind(this));
        this.socket.on("timeout", this.onSocketTimeout.bind(this));
        this.socket.setTimeout(this.pingTimeout);
        this.isStarting = true;
    }

    stop() {
        if (this.isStarting) {
            this.isStarting = false;
            if (this.playStreamId > 0) {
                this.onDeleteStream({streamId: this.playStreamId});
            }
            if (this.publishStreamId > 0) {
                this.onDeleteStream({streamId: this.publishStreamId});
            }
            if (this.pingInterval != null) {
                clearInterval(this.pingInterval);
                this.pingInterval = null;
            }
            Logger$2.log(`disconnect id=${this.id}`);
            this.emit(RtmpSessionEvents$2.DoneConnect, this.id, this.connectCmdObj);
            core_ctx.sessions.delete(this.id);
            this.socket.destroy();
        }
    }

    reject() {
        Logger$2.log(`[reject] id=${this.id}`);
        this.stop();
    }

    flush() {
        if (this.numPlayCache > 0) {
            this.res.uncork();
        }
    }

    onSocketClose() {
        this.stop();
    }

    onSocketError(e) {
        this.stop();
    }

    onSocketTimeout() {
        this.stop();
    }

    onSocketData(data) {
        let bytes = data.length;
        let p = 0;
        let n = 0;
        while (bytes > 0) {
            switch (this.handshakeState) {
                case RTMP_HANDSHAKE_UNINIT:
                    this.handshakeState = RTMP_HANDSHAKE_0;
                    this.handshakeBytes = 0;
                    bytes -= 1;
                    p += 1;
                    break;
                case RTMP_HANDSHAKE_0:
                    n = RTMP_HANDSHAKE_SIZE - this.handshakeBytes;
                    n = n <= bytes ? n : bytes;
                    data.copy(this.handshakePayload, this.handshakeBytes, p, p + n);
                    this.handshakeBytes += n;
                    bytes -= n;
                    p += n;
                    if (this.handshakeBytes === RTMP_HANDSHAKE_SIZE) {
                        this.handshakeState = RTMP_HANDSHAKE_1;
                        this.handshakeBytes = 0;
                        let s0s1s2 = handshake.generateS0S1S2(this.handshakePayload);
                        this.socket.write(s0s1s2);
                    }
                    break;
                case RTMP_HANDSHAKE_1:
                    n = RTMP_HANDSHAKE_SIZE - this.handshakeBytes;
                    n = n <= bytes ? n : bytes;
                    data.copy(this.handshakePayload, this.handshakeBytes, p, n);
                    this.handshakeBytes += n;
                    bytes -= n;
                    p += n;
                    if (this.handshakeBytes === RTMP_HANDSHAKE_SIZE) {
                        this.handshakeState = RTMP_HANDSHAKE_2;
                        this.handshakeBytes = 0;
                        this.handshakePayload = null;
                    }
                    break;
                case RTMP_HANDSHAKE_2:
                default:
                    return this.rtmpChunkRead(data, p, bytes);
            }
        }
    }

    rtmpChunkBasicHeaderCreate(fmt, cid) {
        let out;
        if (cid >= 64 + 255) {
            out = Buffer.alloc(3);
            out[0] = (fmt << 6) | 1;
            out[1] = (cid - 64) & 0xff;
            out[2] = ((cid - 64) >> 8) & 0xff;
        } else if (cid >= 64) {
            out = Buffer.alloc(2);
            out[0] = (fmt << 6) | 0;
            out[1] = (cid - 64) & 0xff;
        } else {
            out = Buffer.alloc(1);
            out[0] = (fmt << 6) | cid;
        }
        return out;
    }

    rtmpChunkMessageHeaderCreate(header) {
        let out = Buffer.alloc(rtmpHeaderSize[header.fmt % 4]);
        if (header.fmt <= RTMP_CHUNK_TYPE_2) {
            out.writeUIntBE(header.timestamp >= 0xffffff ? 0xffffff : header.timestamp, 0, 3);
        }
        if (header.fmt <= RTMP_CHUNK_TYPE_1) {
            out.writeUIntBE(header.length, 3, 3);
            out.writeUInt8(header.type, 6);
        }
        if (header.fmt === RTMP_CHUNK_TYPE_0) {
            out.writeUInt32LE(header.stream_id, 7);
        }
        return out;
    }

    rtmpChunksCreate(packet) {
        let header = packet.header;
        let payload = packet.payload;
        let payloadSize = header.length;
        let chunkSize = this.outChunkSize;
        let chunksOffset = 0;
        let payloadOffset = 0;
        let chunkBasicHeader = this.rtmpChunkBasicHeaderCreate(header.fmt, header.cid);
        let chunkBasicHeader3 = this.rtmpChunkBasicHeaderCreate(RTMP_CHUNK_TYPE_3, header.cid);
        let chunkMessageHeader = this.rtmpChunkMessageHeaderCreate(header);
        let useExtendedTimestamp = header.timestamp >= 0xffffff;
        let headerSize = chunkBasicHeader.length + chunkMessageHeader.length + (useExtendedTimestamp ? 4 : 0);
        let n = headerSize + payloadSize + Math.floor(payloadSize / chunkSize);
        if (useExtendedTimestamp) {
            n += Math.floor(payloadSize / chunkSize) * 4;
        }
        if (!(payloadSize % chunkSize)) {
            n -= 1;
            if (useExtendedTimestamp) {
                n -= 4;
            }
        }
        let chunks = Buffer.alloc(n);
        chunkBasicHeader.copy(chunks, chunksOffset);
        chunksOffset += chunkBasicHeader.length;
        chunkMessageHeader.copy(chunks, chunksOffset);
        chunksOffset += chunkMessageHeader.length;
        if (useExtendedTimestamp) {
            chunks.writeUInt32BE(header.timestamp, chunksOffset);
            chunksOffset += 4;
        }
        while (payloadSize > 0) {
            if (payloadSize > chunkSize) {
                payload.copy(chunks, chunksOffset, payloadOffset, payloadOffset + chunkSize);
                payloadSize -= chunkSize;
                chunksOffset += chunkSize;
                payloadOffset += chunkSize;
                chunkBasicHeader3.copy(chunks, chunksOffset);
                chunksOffset += chunkBasicHeader3.length;
                if (useExtendedTimestamp) {
                    chunks.writeUInt32BE(header.timestamp, chunksOffset);
                    chunksOffset += 4;
                }
            } else {
                payload.copy(chunks, chunksOffset, payloadOffset, payloadOffset + payloadSize);
                payloadSize -= payloadSize;
                chunksOffset += payloadSize;
                payloadOffset += payloadSize;
            }
        }
        return chunks;
    }

    rtmpChunkRead(data, p, bytes) {
        let size = 0;
        let offset = 0;
        let extended_timestamp = 0;
        while (offset < bytes) {
            switch (this.parserState) {
                case RTMP_PARSE_INIT:
                    this.parserBytes = 1;
                    this.parserBuffer[0] = data[p + offset++];
                    if (0 === (this.parserBuffer[0] & 0x3f)) {
                        this.parserBasicBytes = 2;
                    } else if (1 === (this.parserBuffer[0] & 0x3f)) {
                        this.parserBasicBytes = 3;
                    } else {
                        this.parserBasicBytes = 1;
                    }
                    this.parserState = RTMP_PARSE_BASIC_HEADER;
                    break;
                case RTMP_PARSE_BASIC_HEADER:
                    while (this.parserBytes < this.parserBasicBytes && offset < bytes) {
                        this.parserBuffer[this.parserBytes++] = data[p + offset++];
                    }
                    if (this.parserBytes >= this.parserBasicBytes) {
                        this.parserState = RTMP_PARSE_MESSAGE_HEADER;
                    }
                    break;
                case RTMP_PARSE_MESSAGE_HEADER:
                    size = rtmpHeaderSize[this.parserBuffer[0] >> 6] + this.parserBasicBytes;
                    while (this.parserBytes < size && offset < bytes) {
                        this.parserBuffer[this.parserBytes++] = data[p + offset++];
                    }
                    if (this.parserBytes >= size) {
                        this.rtmpPacketParse();
                        this.parserState = RTMP_PARSE_EXTENDED_TIMESTAMP;
                    }
                    break;
                case RTMP_PARSE_EXTENDED_TIMESTAMP:
                    size = rtmpHeaderSize[this.parserPacket.header.fmt] + this.parserBasicBytes;
                    if (this.parserPacket.header.timestamp === 0xffffff) size += 4;
                    while (this.parserBytes < size && offset < bytes) {
                        this.parserBuffer[this.parserBytes++] = data[p + offset++];
                    }
                    if (this.parserBytes >= size) {
                        if (this.parserPacket.header.timestamp === 0xffffff) {
                            extended_timestamp = this.parserBuffer.readUInt32BE(rtmpHeaderSize[this.parserPacket.header.fmt] + this.parserBasicBytes);
                        } else {
                            extended_timestamp = this.parserPacket.header.timestamp;
                        }
                        if (this.parserPacket.bytes === 0) {
                            if (RTMP_CHUNK_TYPE_0 === this.parserPacket.header.fmt) {
                                this.parserPacket.clock = extended_timestamp;
                            } else {
                                this.parserPacket.clock += extended_timestamp;
                            }
                            this.rtmpPacketAlloc();
                        }
                        this.parserState = RTMP_PARSE_PAYLOAD;
                    }
                    break;
                case RTMP_PARSE_PAYLOAD:
                    size = Math.min(this.inChunkSize - (this.parserPacket.bytes % this.inChunkSize), this.parserPacket.header.length - this.parserPacket.bytes);
                    size = Math.min(size, bytes - offset);
                    if (size > 0) {
                        data.copy(this.parserPacket.payload, this.parserPacket.bytes, p + offset, p + offset + size);
                    }
                    this.parserPacket.bytes += size;
                    offset += size;
                    if (this.parserPacket.bytes >= this.parserPacket.header.length) {
                        this.parserState = RTMP_PARSE_INIT;
                        this.parserPacket.bytes = 0;
                        if (this.parserPacket.clock > 0xffffffff) {
                            break;
                        }
                        this.rtmpHandler();
                    } else if (0 === this.parserPacket.bytes % this.inChunkSize) {
                        this.parserState = RTMP_PARSE_INIT;
                    }
                    break;
            }
        }
        this.inAckSize += data.length;
        if (this.inAckSize >= 0xf0000000) {
            this.inAckSize = 0;
            this.inLastAck = 0;
        }
        if (this.ackSize > 0 && this.inAckSize - this.inLastAck >= this.ackSize) {
            this.inLastAck = this.inAckSize;
            this.sendACK(this.inAckSize);
        }
    }

    rtmpPacketParse() {
        let fmt = this.parserBuffer[0] >> 6;
        let cid = 0;
        if (this.parserBasicBytes === 2) {
            cid = 64 + this.parserBuffer[1];
        } else if (this.parserBasicBytes === 3) {
            cid = (64 + this.parserBuffer[1] + this.parserBuffer[2]) << 8;
        } else {
            cid = this.parserBuffer[0] & 0x3f;
        }
        let hasp = this.inPackets.has(cid);
        if (!hasp) {
            this.parserPacket = RtmpPacket.create(fmt, cid);
            this.inPackets.set(cid, this.parserPacket);
        } else {
            this.parserPacket = this.inPackets.get(cid);
        }
        this.parserPacket.header.fmt = fmt;
        this.parserPacket.header.cid = cid;
        this.rtmpChunkMessageHeaderRead();
        if (this.parserPacket.header.type > RTMP_TYPE_METADATA) {
            Logger$2.error("packet parse error.", this.parserPacket);
            this.stop();
        }
    }

    rtmpChunkMessageHeaderRead() {
        let offset = this.parserBasicBytes;
        if (this.parserPacket.header.fmt <= RTMP_CHUNK_TYPE_2) {
            this.parserPacket.header.timestamp = this.parserBuffer.readUIntBE(offset, 3);
            offset += 3;
        }
        if (this.parserPacket.header.fmt <= RTMP_CHUNK_TYPE_1) {
            this.parserPacket.header.length = this.parserBuffer.readUIntBE(offset, 3);
            this.parserPacket.header.type = this.parserBuffer[offset + 3];
            offset += 4;
        }
        if (this.parserPacket.header.fmt === RTMP_CHUNK_TYPE_0) {
            this.parserPacket.header.stream_id = this.parserBuffer.readUInt32LE(offset);
            offset += 4;
        }
        return offset;
    }

    rtmpPacketAlloc() {
        if (this.parserPacket.capacity < this.parserPacket.header.length) {
            this.parserPacket.payload = Buffer.alloc(this.parserPacket.header.length + 1024);
            this.parserPacket.capacity = this.parserPacket.header.length + 1024;
        }
    }

    rtmpHandler() {
        switch (this.parserPacket.header.type) {
            case RTMP_TYPE_SET_CHUNK_SIZE:
            case RTMP_TYPE_ABORT:
            case RTMP_TYPE_ACKNOWLEDGEMENT:
            case RTMP_TYPE_WINDOW_ACKNOWLEDGEMENT_SIZE:
            case RTMP_TYPE_SET_PEER_BANDWIDTH:
                return 0 === this.rtmpControlHandler() ? -1 : 0;
            case RTMP_TYPE_EVENT:
                return 0 === this.rtmpEventHandler() ? -1 : 0;
            case RTMP_TYPE_AUDIO:
                return this.rtmpAudioHandler();
            case RTMP_TYPE_VIDEO:
                return this.rtmpVideoHandler();
            case RTMP_TYPE_FLEX_MESSAGE:
            case RTMP_TYPE_INVOKE:
                return this.rtmpInvokeHandler();
            case RTMP_TYPE_FLEX_STREAM:
            case RTMP_TYPE_DATA:
                return this.rtmpDataHandler();
        }
    }

    rtmpControlHandler() {
        let payload = this.parserPacket.payload;
        switch (this.parserPacket.header.type) {
            case RTMP_TYPE_SET_CHUNK_SIZE:
                this.inChunkSize = payload.readUInt32BE();
                break;
            case RTMP_TYPE_ABORT:
                break;
            case RTMP_TYPE_ACKNOWLEDGEMENT:
                break;
            case RTMP_TYPE_WINDOW_ACKNOWLEDGEMENT_SIZE:
                this.ackSize = payload.readUInt32BE();
                break;
        }
    }

    rtmpEventHandler() {
    }

    rtmpAudioHandler() {
        let payload = this.parserPacket.payload.slice(0, this.parserPacket.header.length);
        let sound_format = (payload[0] >> 4) & 0x0f;
        let sound_type = payload[0] & 0x01;
        let sound_size = (payload[0] >> 1) & 0x01;
        let sound_rate = (payload[0] >> 2) & 0x03;
        if (this.audioCodec == 0) {
            this.audioCodec = sound_format;
            this.audioCodecName = AUDIO_CODEC_NAME$1[sound_format];
            this.audioSamplerate = AUDIO_SOUND_RATE$1[sound_rate];
            this.audioChannels = ++sound_type;
            if (sound_format == 4) {
                this.audioSamplerate = 16000;
            } else if (sound_format == 5) {
                this.audioSamplerate = 8000;
            } else if (sound_format == 11) {
                this.audioSamplerate = 16000;
            } else if (sound_format == 14) {
                this.audioSamplerate = 8000;
            }
            if (sound_format != 10) {
                Logger$2.log(
                    `[publish] Handle audio. id=${this.id} streamPath=${
                        this.publishStreamPath
                    } sound_format=${sound_format} sound_type=${sound_type} sound_size=${sound_size} sound_rate=${sound_rate} codec_name=${this.audioCodecName} ${this.audioSamplerate} ${
                        this.audioChannels
                    }ch`
                );
            }
        }
        if (sound_format == 10 && payload[1] == 0) {
            this.isFirstAudioReceived = true;
            this.aacSequenceHeader = Buffer.alloc(payload.length);
            payload.copy(this.aacSequenceHeader);
            let info = core_av.readAACSpecificConfig(this.aacSequenceHeader);
            this.audioProfileName = core_av.getAACProfileName(info);
            this.audioSamplerate = info.sample_rate;
            this.audioChannels = info.channels;
            Logger$2.log(
                `[publish] Handle audio. id=${this.id} streamPath=${
                    this.publishStreamPath
                } sound_format=${sound_format} sound_type=${sound_type} sound_size=${sound_size} sound_rate=${sound_rate} codec_name=${this.audioCodecName} ${this.audioSamplerate} ${
                    this.audioChannels
                }ch`
            );
        }
        let packet = RtmpPacket.create();
        packet.header.fmt = RTMP_CHUNK_TYPE_0;
        packet.header.cid = RTMP_CHANNEL_AUDIO;
        packet.header.type = RTMP_TYPE_AUDIO;
        packet.payload = payload;
        packet.header.length = packet.payload.length;
        packet.header.timestamp = this.parserPacket.clock;
        let rtmpChunks = this.rtmpChunksCreate(packet);
        let flvTag = flv_session.createFlvTag(packet);
        if (this.rtmpGopCacheQueue != null) {
            if (this.aacSequenceHeader != null && payload[1] === 0) ; else {
                this.rtmpGopCacheQueue.add(rtmpChunks);
            }
        }
        for (let playerId of this.players) {
            let playerSession = core_ctx.sessions.get(playerId);
            if (playerSession.numPlayCache === 0) {
                playerSession.res.cork();
            }
            if (playerSession instanceof RtmpSession) {
                if (playerSession.isStarting && playerSession.isPlaying && !playerSession.isPause && playerSession.isReceiveAudio) {
                    rtmpChunks.writeUInt32LE(playerSession.playStreamId, 8);
                    playerSession.res.write(rtmpChunks);
                }
            } else if (playerSession instanceof flv_session) {
                playerSession.res.write(flvTag, null, e => {
                });
            }
            playerSession.numPlayCache++;
            if (playerSession.numPlayCache === 10) {
                process.nextTick(() => playerSession.res.uncork());
                playerSession.numPlayCache = 0;
            }
        }
    }

    rtmpVideoHandler() {
        let payload = this.parserPacket.payload.slice(0, this.parserPacket.header.length);
        let frame_type = (payload[0] >> 4) & 0x0f;
        let codec_id = payload[0] & 0x0f;
        if (codec_id == 7 || codec_id == 12) {
            if (frame_type == 1 && payload[1] == 0) {
                this.avcSequenceHeader = Buffer.alloc(payload.length);
                payload.copy(this.avcSequenceHeader);
                let info = core_av.readAVCSpecificConfig(this.avcSequenceHeader);
                this.videoWidth = info.width;
                this.videoHeight = info.height;
                this.videoProfileName = core_av.getAVCProfileName(info);
                this.videoLevel = info.level;
                this.rtmpGopCacheQueue = this.gopCacheEnable ? new Set() : null;
                this.flvGopCacheQueue = this.gopCacheEnable ? new Set() : null;
            }
        }
        if (this.videoCodec == 0) {
            this.videoCodec = codec_id;
            this.videoCodecName = VIDEO_CODEC_NAME$1[codec_id];
            Logger$2.log(
                `[publish] Handle video. id=${this.id} streamPath=${this.publishStreamPath} frame_type=${frame_type} codec_id=${codec_id} codec_name=${this.videoCodecName} ${
                    this.videoWidth
                }x${this.videoHeight}`
            );
        }
        let packet = RtmpPacket.create();
        packet.header.fmt = RTMP_CHUNK_TYPE_0;
        packet.header.cid = RTMP_CHANNEL_VIDEO;
        packet.header.type = RTMP_TYPE_VIDEO;
        packet.payload = payload;
        packet.header.length = packet.payload.length;
        packet.header.timestamp = this.parserPacket.clock;
        let rtmpChunks = this.rtmpChunksCreate(packet);
        let flvTag = flv_session.createFlvTag(packet);
        if ((codec_id == 7 || codec_id == 12) && this.rtmpGopCacheQueue != null) {
            if (frame_type == 1 && payload[1] == 1) {
                this.rtmpGopCacheQueue.clear();
                this.flvGopCacheQueue.clear();
            }
            if (frame_type == 1 && payload[1] == 0) ; else {
                this.rtmpGopCacheQueue.add(rtmpChunks);
            }
        }
        for (let playerId of this.players) {
            let playerSession = core_ctx.sessions.get(playerId);
            if (playerSession.numPlayCache === 0) {
                playerSession.res.cork();
            }
            if (playerSession instanceof RtmpSession) {
                if (playerSession.isStarting && playerSession.isPlaying && !playerSession.isPause && playerSession.isReceiveVideo) {
                    rtmpChunks.writeUInt32LE(playerSession.playStreamId, 8);
                    playerSession.res.write(rtmpChunks);
                }
            } else if (playerSession instanceof flv_session) {
                playerSession.res.write(flvTag, null, e => {
                });
            }
            playerSession.numPlayCache++;
            if (playerSession.numPlayCache === 10) {
                process.nextTick(() => playerSession.res.uncork());
                playerSession.numPlayCache = 0;
            }
        }
    }

    rtmpDataHandler() {
        let offset = this.parserPacket.header.type === RTMP_TYPE_FLEX_STREAM ? 1 : 0;
        let payload = this.parserPacket.payload.slice(offset, this.parserPacket.header.length);
        let dataMessage = core_amf.decodeAmf0Data(payload);
        switch (dataMessage.cmd) {
            case "@setDataFrame":
                if (dataMessage.dataObj) {
                    this.audioSamplerate = dataMessage.dataObj.audiosamplerate;
                    this.audioChannels = dataMessage.dataObj.stereo ? 2 : 1;
                    this.videoWidth = dataMessage.dataObj.width;
                    this.videoHeight = dataMessage.dataObj.height;
                    this.videoFps = dataMessage.dataObj.framerate;
                }
                let opt = {
                    cmd: "onMetaData",
                    dataObj: dataMessage.dataObj
                };
                this.metaData = core_amf.encodeAmf0Data(opt);
                let packet = RtmpPacket.create();
                packet.header.fmt = RTMP_CHUNK_TYPE_0;
                packet.header.cid = RTMP_CHANNEL_DATA;
                packet.header.type = RTMP_TYPE_DATA;
                packet.payload = this.metaData;
                packet.header.length = packet.payload.length;
                let rtmpChunks = this.rtmpChunksCreate(packet);
                let flvTag = flv_session.createFlvTag(packet);
                for (let playerId of this.players) {
                    let playerSession = core_ctx.sessions.get(playerId);
                    if (playerSession instanceof RtmpSession) {
                        if (playerSession.isStarting && playerSession.isPlaying && !playerSession.isPause) {
                            rtmpChunks.writeUInt32LE(playerSession.playStreamId, 8);
                            playerSession.socket.write(rtmpChunks);
                        }
                    } else if (playerSession instanceof flv_session) {
                        playerSession.res.write(flvTag, null, e => {
                        });
                    }
                }
                break;
        }
    }

    rtmpInvokeHandler() {
        let offset = this.parserPacket.header.type === RTMP_TYPE_FLEX_MESSAGE ? 1 : 0;
        let payload = this.parserPacket.payload.slice(offset, this.parserPacket.header.length);
        let invokeMessage = core_amf.decodeAmf0Cmd(payload);
        switch (invokeMessage.cmd) {
            case "connect":
                this.onConnect(invokeMessage);
                break;
            case "releaseStream":
                break;
            case "FCPublish":
                break;
            case "createStream":
                this.onCreateStream(invokeMessage);
                break;
            case "publish":
                this.onPublish(invokeMessage);
                break;
            case "play":
                this.onPlay(invokeMessage);
                break;
            case "pause":
                this.onPause(invokeMessage);
                break;
            case "FCUnpublish":
                break;
            case "deleteStream":
                this.onDeleteStream(invokeMessage);
                break;
            case "closeStream":
                this.onCloseStream();
                break;
            case "receiveAudio":
                this.onReceiveAudio(invokeMessage);
                break;
            case "receiveVideo":
                this.onReceiveVideo(invokeMessage);
                break;
        }
    }

    sendACK(size) {
        let rtmpBuffer = Buffer.from("02000000000004030000000000000000", "hex");
        rtmpBuffer.writeUInt32BE(size, 12);
        this.socket.write(rtmpBuffer);
    }

    sendWindowACK(size) {
        let rtmpBuffer = Buffer.from("02000000000004050000000000000000", "hex");
        rtmpBuffer.writeUInt32BE(size, 12);
        this.socket.write(rtmpBuffer);
    }

    setPeerBandwidth(size, type) {
        let rtmpBuffer = Buffer.from("0200000000000506000000000000000000", "hex");
        rtmpBuffer.writeUInt32BE(size, 12);
        rtmpBuffer[16] = type;
        this.socket.write(rtmpBuffer);
    }

    setChunkSize(size) {
        let rtmpBuffer = Buffer.from("02000000000004010000000000000000", "hex");
        rtmpBuffer.writeUInt32BE(size, 12);
        this.socket.write(rtmpBuffer);
    }

    sendStreamStatus(st, id) {
        let rtmpBuffer = Buffer.from("020000000000060400000000000000000000", "hex");
        rtmpBuffer.writeUInt16BE(st, 12);
        rtmpBuffer.writeUInt32BE(id, 14);
        this.socket.write(rtmpBuffer);
    }

    sendInvokeMessage(sid, opt) {
        let packet = RtmpPacket.create();
        packet.header.fmt = RTMP_CHUNK_TYPE_0;
        packet.header.cid = RTMP_CHANNEL_INVOKE;
        packet.header.type = RTMP_TYPE_INVOKE;
        packet.header.stream_id = sid;
        packet.payload = core_amf.encodeAmf0Cmd(opt);
        packet.header.length = packet.payload.length;
        let chunks = this.rtmpChunksCreate(packet);
        this.socket.write(chunks);
    }

    sendDataMessage(opt, sid) {
        let packet = RtmpPacket.create();
        packet.header.fmt = RTMP_CHUNK_TYPE_0;
        packet.header.cid = RTMP_CHANNEL_DATA;
        packet.header.type = RTMP_TYPE_DATA;
        packet.payload = core_amf.encodeAmf0Data(opt);
        packet.header.length = packet.payload.length;
        packet.header.stream_id = sid;
        let chunks = this.rtmpChunksCreate(packet);
        this.socket.write(chunks);
    }

    sendStatusMessage(sid, level, code, description) {
        let opt = {
            cmd: "onStatus",
            transId: 0,
            cmdObj: null,
            info: {
                level: level,
                code: code,
                description: description
            }
        };
        this.sendInvokeMessage(sid, opt);
    }

    sendRtmpSampleAccess(sid) {
        let opt = {
            cmd: "|RtmpSampleAccess",
            bool1: false,
            bool2: false
        };
        this.sendDataMessage(opt, sid);
    }

    sendPingRequest() {
        let currentTimestamp = Date.now() - this.startTimestamp;
        let packet = RtmpPacket.create();
        packet.header.fmt = RTMP_CHUNK_TYPE_0;
        packet.header.cid = RTMP_CHANNEL_PROTOCOL;
        packet.header.type = RTMP_TYPE_EVENT;
        packet.header.timestamp = currentTimestamp;
        packet.payload = Buffer.from([0, 6, (currentTimestamp >> 24) & 0xff, (currentTimestamp >> 16) & 0xff, (currentTimestamp >> 8) & 0xff, currentTimestamp & 0xff]);
        packet.header.length = packet.payload.length;
        let chunks = this.rtmpChunksCreate(packet);
        this.socket.write(chunks);
    }

    respondConnect(tid) {
        let opt = {
            cmd: "_result",
            transId: tid,
            cmdObj: {
                fmsVer: "FMS/3,0,1,123",
                capabilities: 31
            },
            info: {
                level: "status",
                code: "NetConnection.Connect.Success",
                description: "Connection succeeded.",
                objectEncoding: this.objectEncoding
            }
        };
        this.sendInvokeMessage(0, opt);
    }

    respondCreateStream(tid) {
        this.streams++;
        let opt = {
            cmd: "_result",
            transId: tid,
            cmdObj: null,
            info: this.streams
        };
        this.sendInvokeMessage(0, opt);
    }

    respondPlay() {
        this.sendStreamStatus(STREAM_BEGIN, this.playStreamId);
        this.sendStatusMessage(this.playStreamId, "status", "NetStream.Play.Reset", "Playing and resetting stream.");
        this.sendStatusMessage(this.playStreamId, "status", "NetStream.Play.Start", "Started playing stream.");
        this.sendRtmpSampleAccess();
    }

    onConnect(invokeMessage) {
        this.connectCmdObj = invokeMessage.cmdObj;
        this.appname = invokeMessage.cmdObj.app;
        let qappidx = this.appname.indexOf("?");
        let appArr = qappidx > 0 ? this.appname.substr(0, qappidx) : this.appname;
        this.appInfo = {
            remoteIp: this.ip,
            app: appArr,
            name: appArr.split("/").last(),
            query: (qappidx > 1) ? this.appInfo.query = helpers_1.arrayToObject(this.appname.substr(qappidx + 1).split("&")) : {}
        };
        let authRes = this.emit(RtmpSessionEvents$2.PreConnect, this.sessionInfo);
        if (authRes[0] === false) {
            Logger$2.log(this.id, "Auth Rejected", authRes);
            this.sendStatusMessage(this.playStreamId, "status", "NetStream.Play.Stop", "Authorization required.");
            return;
        }
        if (!this.isStarting) {
            Logger$2.log(this.playStreamId, "Is already Starting");
            return;
        }
        this.objectEncoding = invokeMessage.cmdObj.objectEncoding != null ? invokeMessage.cmdObj.objectEncoding : 0;
        this.connectTime = new Date();
        this.startTimestamp = Date.now();
        this.pingInterval = setInterval(() => {
            this.sendPingRequest();
        }, this.pingTime);
        this.sendWindowACK(5000000);
        this.setPeerBandwidth(5000000, 2);
        this.setChunkSize(this.outChunkSize);
        this.respondConnect(invokeMessage.transId);
        Logger$2.log(`[rtmp connect] id=${this.id} ip=${this.ip} app=${this.appname} args=${JSON.stringify(invokeMessage.cmdObj)}`);
        this.emit(RtmpSessionEvents$2.PostConnect, this.sessionInfo);
    }

    onCreateStream(invokeMessage) {
        this.respondCreateStream(invokeMessage.transId);
    }

    onPublish(invokeMessage) {
        if (typeof invokeMessage.streamName !== "string") {
            return;
        }
        if (!this.pushAllowType.check(this.ip)) {
            console.log("Push reject", this.pushAllowType);
            this.sendStatusMessage(this.playStreamId, "error", "NetStream.publish.Unauthorized", "Authorization required.");
            return;
        }
        this.publishStreamPath = ("/" + this.appname + "/" + invokeMessage.streamName.split("?")[0]);
        this.publishArgs = querystring__default['default'].parse(invokeMessage.streamName.split("?")[1]);
        this.publishStreamId = this.parserPacket.header.stream_id;
        this.emit(RtmpSessionEvents$2.PrePublish, this.id, this.publishStreamPath, this.publishArgs);
        if (!this.isStarting) {
            return;
        }
        if (core_ctx.publishers.has(this.publishStreamPath)) {
            Logger$2.log(`[publish] Already has a stream. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
            this.sendStatusMessage(this.publishStreamId, "error", "NetStream.Publish.BadName", "Stream already publishing");
        } else if (this.isPublishing) {
            Logger$2.log(`[publish] NetConnection is publishing. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
            this.sendStatusMessage(this.publishStreamId, "error", "NetStream.Publish.BadConnection", "Connection already publishing");
        } else {
            Logger$2.log(`[publish] New stream. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
            core_ctx.publishers.set(this.publishStreamPath, this.id);
            this.isPublishing = true;
            this.sendStatusMessage(this.publishStreamId, "status", "NetStream.Publish.Start", `${this.publishStreamPath} is now published.`);
            for (let idlePlayerId of core_ctx.idlePlayers) {
                let idlePlayer = core_ctx.sessions.get(idlePlayerId);
                if (idlePlayer.playStreamPath === this.publishStreamPath) {
                    idlePlayer.onStartPlay();
                    core_ctx.idlePlayers.delete(idlePlayerId);
                }
            }
            this.emit(RtmpSessionEvents$2.PostPublish, this.id, this.publishStreamPath, this.publishArgs);
        }
    }

    onPlay(invokeMessage) {
        if (typeof invokeMessage.streamName !== "string") {
            return;
        }
        this.playStreamPath = "/" + this.appname + "/" + invokeMessage.streamName.split("?")[0];
        this.playArgs = querystring__default['default'].parse(invokeMessage.streamName.split("?")[1]);
        this.playStreamId = this.parserPacket.header.stream_id;
        this.emit(RtmpSessionEvents$2.PrePlay, this.id, this.playStreamPath, this.playArgs);
        if (!this.isStarting) {
            return;
        }
        if (!this.pullAllowType.check(this.ip)) {
            console.log("Pull Reject", this.pullAllowType);
            this.sendStatusMessage(this.playStreamId, "error", "NetStream.play.Unauthorized", "Authorization required.");
            return;
        }
        if (this.isPlaying) {
            Logger$2.log(`[play] NetConnection is playing. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} `);
            this.sendStatusMessage(this.playStreamId, "error", "NetStream.Play.BadConnection", "Connection already playing");
        } else {
            Logger$2.log(`[play] NetConnection responding playing. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} `);
            this.respondPlay();
        }
        if (core_ctx.publishers.has(this.playStreamPath)) {
            this.onStartPlay();
        } else {
            Logger$2.log(`[play] Stream not found. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId}`);
            this.isIdling = true;
            core_ctx.idlePlayers.add(this.id);
        }
    }

    onStartPlay() {
        let publisherId = core_ctx.publishers.get(this.playStreamPath);
        let publisher = core_ctx.sessions.get(publisherId);
        let players = publisher.players;
        players.add(this.id);
        if (publisher.metaData != null) {
            let packet = RtmpPacket.create();
            packet.header.fmt = RTMP_CHUNK_TYPE_0;
            packet.header.cid = RTMP_CHANNEL_DATA;
            packet.header.type = RTMP_TYPE_DATA;
            packet.payload = publisher.metaData;
            packet.header.length = packet.payload.length;
            packet.header.stream_id = this.playStreamId;
            let chunks = this.rtmpChunksCreate(packet);
            this.socket.write(chunks);
        }
        if (publisher.audioCodec === 10) {
            let packet = RtmpPacket.create();
            packet.header.fmt = RTMP_CHUNK_TYPE_0;
            packet.header.cid = RTMP_CHANNEL_AUDIO;
            packet.header.type = RTMP_TYPE_AUDIO;
            packet.payload = publisher.aacSequenceHeader;
            packet.header.length = packet.payload.length;
            packet.header.stream_id = this.playStreamId;
            let chunks = this.rtmpChunksCreate(packet);
            this.socket.write(chunks);
        }
        if (publisher.videoCodec === 7 || publisher.videoCodec === 12) {
            let packet = RtmpPacket.create();
            packet.header.fmt = RTMP_CHUNK_TYPE_0;
            packet.header.cid = RTMP_CHANNEL_VIDEO;
            packet.header.type = RTMP_TYPE_VIDEO;
            packet.payload = publisher.avcSequenceHeader;
            packet.header.length = packet.payload.length;
            packet.header.stream_id = this.playStreamId;
            let chunks = this.rtmpChunksCreate(packet);
            this.socket.write(chunks);
        }
        if (publisher.rtmpGopCacheQueue != null) {
            for (let chunks of publisher.rtmpGopCacheQueue) {
                chunks.writeUInt32LE(this.playStreamId, 8);
                this.socket.write(chunks);
            }
        }
        this.isIdling = false;
        this.isPlaying = true;
        this.emit(RtmpSessionEvents$2.PostPlay, this.id, this.playStreamPath, this.playArgs);
        Logger$2.log(`[play] Join stream. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} `);
    }

    onPause(invokeMessage) {
        this.isPause = invokeMessage.pause;
        let c = this.isPause ? "NetStream.Pause.Notify" : "NetStream.Unpause.Notify";
        let d = this.isPause ? "Paused live" : "Unpaused live";
        Logger$2.log(`[play] ${d} stream. id=${this.id} streamPath=${this.playStreamPath}  streamId=${this.playStreamId} `);
        if (!this.isPause) {
            this.sendStreamStatus(STREAM_BEGIN, this.playStreamId);
            if (core_ctx.publishers.has(this.publishStreamPath)) {
                let publisherId = core_ctx.publishers.get(this.playStreamPath);
                let publisher = core_ctx.sessions.get(publisherId);
                let players = publisher.players;
                if (publisher.audioCodec === 10) {
                    let packet = RtmpPacket.create();
                    packet.header.fmt = RTMP_CHUNK_TYPE_0;
                    packet.header.cid = RTMP_CHANNEL_AUDIO;
                    packet.header.type = RTMP_TYPE_AUDIO;
                    packet.payload = publisher.aacSequenceHeader;
                    packet.header.length = packet.payload.length;
                    packet.header.stream_id = this.playStreamId;
                    packet.header.timestamp = publisher.parserPacket.clock;
                    let chunks = this.rtmpChunksCreate(packet);
                    this.socket.write(chunks);
                }
                if (publisher.videoCodec === 7 || publisher.videoCodec === 12) {
                    let packet = RtmpPacket.create();
                    packet.header.fmt = RTMP_CHUNK_TYPE_0;
                    packet.header.cid = RTMP_CHANNEL_VIDEO;
                    packet.header.type = RTMP_TYPE_VIDEO;
                    packet.payload = publisher.avcSequenceHeader;
                    packet.header.length = packet.payload.length;
                    packet.header.stream_id = this.playStreamId;
                    packet.header.timestamp = publisher.parserPacket.clock;
                    let chunks = this.rtmpChunksCreate(packet);
                    this.socket.write(chunks);
                }
            }
        } else {
            this.sendStreamStatus(STREAM_EOF, this.playStreamId);
        }
        this.sendStatusMessage(this.playStreamId, c, d);
    }

    onReceiveAudio(invokeMessage) {
        this.isReceiveAudio = invokeMessage.bool;
        Logger$2.log(`[play] receiveAudio=${this.isReceiveAudio} id=${this.id} `);
    }

    onReceiveVideo(invokeMessage) {
        this.isReceiveVideo = invokeMessage.bool;
        Logger$2.log(`[play] receiveVideo=${this.isReceiveVideo} id=${this.id} `);
    }

    onCloseStream() {
        let closeStream = {streamId: this.parserPacket.header.stream_id};
        this.onDeleteStream(closeStream);
    }

    onDeleteStream(invokeMessage) {
        if (invokeMessage.streamId == this.playStreamId) {
            if (this.isIdling) {
                core_ctx.idlePlayers.delete(this.id);
                this.isIdling = false;
            } else {
                let publisherId = core_ctx.publishers.get(this.playStreamPath);
                if (publisherId != null) {
                    core_ctx.sessions.get(publisherId).players.delete(this.id);
                }
                this.emit(RtmpSessionEvents$2.DonePlay, this.id, this.playStreamPath, this.playArgs);
                this.isPlaying = false;
            }
            Logger$2.log(`[play] Close stream. id=${this.id} streamPath=${this.playStreamPath} streamId=${this.playStreamId}`);
            if (this.isStarting) {
                this.sendStatusMessage(this.playStreamId, "status", "NetStream.Play.Stop", "Stopped playing stream.");
            }
            this.playStreamId = 0;
            this.playStreamPath = "";
        }
        if (invokeMessage.streamId == this.publishStreamId) {
            if (this.isPublishing) {
                Logger$2.log(`[publish] Close stream. id=${this.id} streamPath=${this.publishStreamPath} streamId=${this.publishStreamId}`);
                this.emit(RtmpSessionEvents$2.DonePublish, this.id, this.publishStreamPath, this.publishArgs);
                if (this.isStarting) {
                    this.sendStatusMessage(this.publishStreamId, "status", "NetStream.Unpublish.Success", `${this.publishStreamPath} is now unpublished.`);
                }
                for (let playerId of this.players) {
                    let playerSession = core_ctx.sessions.get(playerId);
                    if (playerSession instanceof RtmpSession) {
                        playerSession.sendStatusMessage(playerSession.playStreamId, "status", "NetStream.Play.UnpublishNotify", "stream is now unpublished.");
                        playerSession.flush();
                    } else {
                        playerSession.stop();
                    }
                }
                for (let playerId of this.players) {
                    let playerSession = core_ctx.sessions.get(playerId);
                    core_ctx.idlePlayers.add(playerId);
                    playerSession.isPlaying = false;
                    playerSession.isIdling = true;
                    if (playerSession instanceof RtmpSession) {
                        playerSession.sendStreamStatus(STREAM_EOF, playerSession.playStreamId);
                    }
                }
                core_ctx.publishers.delete(this.publishStreamPath);
                if (this.rtmpGopCacheQueue) {
                    this.rtmpGopCacheQueue.clear();
                }
                if (this.flvGopCacheQueue) {
                    this.flvGopCacheQueue.clear();
                }
                this.players.clear();
                this.isPublishing = false;
            }
            this.publishStreamId = 0;
            this.publishStreamPath = "";
        }
    }
}

var session = {
    NodeRtmpSession: RtmpSession,
    RtmpSessionEvents: RtmpSessionEvents$2,
};

const {NodeRtmpSession} = session;
const {FFmpegSession: FFmpegSession$1} = ffmpeg_session;
const {EventHandler: EventHandler$3, InternalEventHandler: InternalEventHandler$5, Event: Event$4, EventItem: EventItem$4, EventsCache: EventsCache$4} = event_handler;
const {RtmpRelayEvents: RtmpRelayEvents$3, RtmpServerEvents: RtmpServerEvents$3, RtmpSessionEvents: RtmpSessionEvents$3, FFmpegEvents: FFmpegEvents$3} = events;
const {ConsoleLogger: ConsoleLogger$4, LogLevel: LogLevel$3} = logger;
const Logger$3 = new ConsoleLogger$4("RTMP_RELAY_SESSION");

class RtmpRelaySession extends InternalEventHandler$5 {
    pushStream(pushServer) {
        if (this.ffmpegSessions.hasOwnProperty(pushServer.id)) {
            return false;
        }
        if (this.rtmpSession.appInfo.name !== pushServer.name) {
            return false;
        }
        if (pushServer.autostart) {
            const ffmpeg = new FFmpegSession$1(
                "rtmp://localhost:" + this.config.rtmp.port + this.rtmpSession.publishStreamPath,
                this.rtmpSession.id, pushServer, this.config.ffmpeg.execPath, this.config.ffmpeg.logLevel);
            ffmpeg.on(FFmpegEvents$3.Error, (event, ...data) => {
            });
            ffmpeg.on(FFmpegEvents$3.Close, (event, ...data) => {
                delete this.ffmpegSessions[ffmpeg.id];
            });
            this.ffmpegSessions[ffmpeg.id] = ffmpeg;
            return true;
        }
        return false;
    }

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
            _this.killFFmpeg();
            session.stop();
            _this.emit(RtmpRelayEvents$3.Close, session.sessionInfo);
            EventHandler$3.emit(RtmpRelayEvents$3.Close, session.sessionInfo);
        });
        session.on(RtmpSessionEvents$3.PreConnect, (evt, id, cmdObj) => {
            let sessInfo = session.sessionInfo;
            _this.emit(RtmpRelayEvents$3.Auth, sessInfo);
            EventHandler$3.emit(RtmpSessionEvents$3.PreConnect, sessInfo);
            let res = EventHandler$3.emit(RtmpRelayEvents$3.Auth, sessInfo);
            if (res) {
                if (res.length > 0 && typeof res[0] === "boolean") return res[0];
                else return false;
            } else {
                console.warn("RtmpRelayEvents.Auth not implemented! using default 'allow all'");
                return true;
            }
        });
        session.on(RtmpSessionEvents$3.PostConnect, (evt, id, cmdObj) => {
            let sessInfo = session.sessionInfo;
            _this.emit(RtmpRelayEvents$3.Connect, sessInfo);
            EventHandler$3.emit(RtmpSessionEvents$3.PostConnect, sessInfo);
            return EventHandler$3.emit(RtmpRelayEvents$3.Connect, sessInfo);
        });
        session.on(RtmpSessionEvents$3.PrePlay, (evt, id, playStreamPath, playArgs) => {
            EventHandler$3.emit(RtmpSessionEvents$3.PrePlay, id, playStreamPath, playArgs);
        });
        session.on(RtmpSessionEvents$3.PostPlay, (evt, id, playStreamPath, playArgs) => {
            EventHandler$3.emit(RtmpSessionEvents$3.PostPlay, id, playStreamPath, playArgs);
        });
        session.on(RtmpSessionEvents$3.DonePlay, (evt, id, playStreamPath, playArgs) => {
            EventHandler$3.emit(RtmpSessionEvents$3.DonePlay, id, playStreamPath, playArgs);
        });
        session.on(RtmpSessionEvents$3.PrePublish, (evt, id, publishStreamPath, publishArgs) => {
            EventHandler$3.emit(RtmpSessionEvents$3.PrePublish, id, publishStreamPath, publishArgs);
        });
        session.on(RtmpSessionEvents$3.PostPublish, (evt, id, publishStreamPath, publishArgs) => {
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
            _this.emit(RtmpRelayEvents$3.Publish, sessInfo);
            return EventHandler$3.emit(RtmpRelayEvents$3.Publish, sessInfo);
        });
        session.on(RtmpSessionEvents$3.DonePublish, (evt, id, publishStreamPath, publishArgs) => {
            _this.killFFmpeg();
            let sessInfo = session.sessionInfo;
            _this.emit(RtmpRelayEvents$3.PublishEnd, sessInfo);
            EventHandler$3.emit(RtmpSessionEvents$3.DonePublish, sessInfo);
        });
        session.on(RtmpSessionEvents$3.DoneConnect, (evt, id, connectCmdObj) => {
            _this.killFFmpeg();
            let sessInfo = session.sessionInfo;
            _this.emit(RtmpRelayEvents$3.Disconnect, sessInfo);
            EventHandler$3.emit(RtmpSessionEvents$3.DoneConnect, sessInfo);
        });
        session.run();
        socket.setTimeout(30000);
    }
}

var relaysession = {
    RtmpRelaySession: RtmpRelaySession,
    RtmpRelayEvents: RtmpRelayEvents$3
};

const {FFmpegSession: FFmpegSession$2, PushServerInfo: PushServerInfo$1} = ffmpeg_session;
const {EventHandler: EventHandler$4, Event: Event$5, EventItem: EventItem$5, EventsCache: EventsCache$5} = event_handler;
const {RtmpRelayEvents: RtmpRelayEvents$4, RtmpServerEvents: RtmpServerEvents$4, RtmpSessionEvents: RtmpSessionEvents$4, FFmpegEvents: FFmpegEvents$4} = events;
const {RtmpRelaySession: RtmpRelaySession$1} = relaysession;
const {ConsoleLogger: ConsoleLogger$5, LogLevel: LogLevel$4} = logger;
const Logger$4 = new ConsoleLogger$5("RTMP_SERVER");

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

    constructor(aliases) {
        this.names = (typeof aliases === "string") ? [aliases] : aliases;
    }
}

const DEFAULT_CONFIG = {
    ffmpeg: {
        execPath: "ffmpeg",
        args: [],
        respawnTimeout: 5,
    },
    rtmp: {
        logLevel: LogLevel$4.Error,
        port: 1935,
        chunk_size: 4096,
        gop_cache: true,
        ping: 30,
        ping_timeout: 30
    },
    rtmpSession: {
        logLevel: LogLevel$4.Error,
        infoInterval: 5,
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
    config.rtmpSession.infoInterval = helpers_1.checkTimeoutArg(config.rtmpSession.infoInterval);
    if (config.hasOwnProperty("ffmpeg")) {
        config.ffmpeg = {...DEFAULT_CONFIG.ffmpeg, ...config.ffmpeg};
    } else {
        config.ffmpeg = {...DEFAULT_CONFIG.ffmpeg};
    }
    config.ffmpeg.respawnTimeout = helpers_1.checkTimeoutArg(config.ffmpeg.respawnTimeout);
    if (config.hasOwnProperty("pushServers")) {
        let servers = {...config.pushServers};
        config.pushServers = [];
        for (let appname in servers) {
            if (!servers.hasOwnProperty(appname)) continue;
            for (let serviceName in servers[appname]) {
                if (!servers[appname].hasOwnProperty(serviceName)) continue;
                config.pushServers.push(new PushServerInfo$1(appname, serviceName,
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
        EventHandler$4.on(event, callback, once);
    }

    once(event, callback) {
        EventHandler$4.once(event, callback);
    }

    off(event, index = -1) {
        EventHandler$4.off(event, index);
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
        this._tcpserver = net__default['default'].createServer();
        this._tcpserver.listen(this.config.rtmp.port, () => {
            Logger$4.log(`Rtmp Server started on port: ${this.config.rtmp.port}`);
            EventHandler$4.emit(RtmpServerEvents$4.Started, this.config.rtmp.port);
        });
        this._tcpserver.on("connection", (socket) => {
            let rtmpReplaySession = new RtmpRelaySession$1(socket, _this.config);
            _this._sessions.set(rtmpReplaySession.id, rtmpReplaySession);
            rtmpReplaySession.once(RtmpRelayEvents$4.Connect, (event, sessionInfo) => {
            });
            rtmpReplaySession.once(RtmpRelayEvents$4.Close, (event, sessionInfo) => {
                _this._sessions.remove(sessionInfo.id);
            });
            this._setInfoTimer(_this);
            EventHandler$4.emit(RtmpServerEvents$4.Connection, socket, rtmpReplaySession);
        });
        this._tcpserver.on('error', (e) => {
            _this._sessions.empty();
            Logger$4.error(`Rtmp Server Error ${e}`);
            EventHandler$4.emit(RtmpServerEvents$4.Error, e);
        });
        this._tcpserver.on('close', (status) => {
            _this._sessions.empty();
            Logger$4.log('Rtmp Server Close.');
            EventHandler$4.emit(RtmpServerEvents$4.Close, status);
        });
    }

    addPushServer(app_name, stream_service, urls, autostart = false, ffmpegArgs = [], logLevel = LogLevel$4.Verbose) {
        if (!this.config.pushServers.hasOwnProperty(app_name + "_" + stream_service)) {
            const psi = new PushServerInfo$1(app_name, stream_service, url, autostart, ffmpegArgs, logLevel);
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
        this._setInfoTimer = function (_this) {
            if (_this._infoTimer) clearTimeout(_this._infoTimer);
            if (_this._sessions.length === 0 || config.rtmpSession.infoInterval === 0) {
                return;
            }
            if (EventHandler$4.has(RtmpServerEvents$4.Info)) {
                let stats = _this._sessions.stats;
                let hash = helpers_1.hash(stats);
                if (hash !== _this._lastHash) {
                    EventHandler$4.emit(RtmpServerEvents$4.Info, stats);
                }
                _this._lastHash = hash;
            }
            _this._infoTimer = setTimeout(_this._setInfoTimer, Math.max(1000, config.rtmpSession.infoInterval), _this);
        };
        Logger$4.level = config.rtmp.logLevel || LogLevel$4.Error;
    }
}

var relayserver = {
    RtmpServerEvents: RtmpServerEvents$4,
    RtmpSessionEvents: RtmpSessionEvents$4,
    FFmpegEvents: FFmpegEvents$4,
    RtmpRelayEvents: RtmpRelayEvents$4,
    FFmpegSession: FFmpegSession$2,
    RtmpRelaySession: RtmpRelaySession$1,
    ConsoleLogger: ConsoleLogger$5,
    LogLevel: LogLevel$4,
    RtmpRelayServer: RtmpRelayServer,
    RtmpAllowType: RtmpAllowType,
    DefaultConfig: DEFAULT_CONFIG,
};
var relayserver_1 = relayserver.RtmpServerEvents;
var relayserver_2 = relayserver.RtmpSessionEvents;
var relayserver_3 = relayserver.FFmpegEvents;
var relayserver_4 = relayserver.RtmpRelayEvents;
var relayserver_5 = relayserver.FFmpegSession;
var relayserver_6 = relayserver.RtmpRelaySession;
var relayserver_7 = relayserver.ConsoleLogger;
var relayserver_8 = relayserver.LogLevel;
var relayserver_9 = relayserver.RtmpRelayServer;
var relayserver_10 = relayserver.RtmpAllowType;
var relayserver_11 = relayserver.DefaultConfig;

exports.ConsoleLogger = relayserver_7;
exports.DefaultConfig = relayserver_11;
exports.FFmpegEvents = relayserver_3;
exports.FFmpegSession = relayserver_5;
exports.LogLevel = relayserver_8;
exports.RtmpAllowType = relayserver_10;
exports.RtmpRelayEvents = relayserver_4;
exports.RtmpRelayServer = relayserver_9;
exports.RtmpRelaySession = relayserver_6;
exports.RtmpServerEvents = relayserver_1;
exports.RtmpSessionEvents = relayserver_2;
exports.default = relayserver;
