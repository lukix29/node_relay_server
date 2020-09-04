const Helpers = require("../helpers");

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

function parseFFmpegHelp() {
// let raw = FS.readFileSync("ffmpeg.txt", {encoding: "utf8"});
// let lines = raw.split(/[\r\n]/gmi).filter((t) => t.length > 0);
// let lastCat = "";
// let commands = {};
// lines.forEach((t) => {
//     if (t.indexOf("-") === 0) {
//         let arr = t.split("\t");
//         let comArr = arr[0].substr(1).split(" ", 2);
//         commands[lastCat][comArr[0]] = {usage: arr[0], info: arr[1], com: comArr[0]};
//     } else {
//         lastCat = t.toLowerCase();
//         commands[lastCat] = {};
//     }
// });
// console.log(commands);
//
// process.exit();
}

function checkCommand(command) {
    if (typeof command !== "string" && command.hasOwnProperty("com")) {
        command = command.com;
    } else if (typeof command !== "string") {
        throw new Error("command must be of type string or object {com: 'command'}")
    }
    // if (command.length > 0 && command.indexOf("-") !== 0) command = "-" + command;
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
        if (!Helpers.isPrimitiveType(args)) {
            throw new Error("args must be of type string");
        }
        command = checkCommand(command);

        this._args.push({
            com: command,
            args: args.toString()
        })
    }

    set(command, args) {
        if (!Helpers.isPrimitiveType(args)) {
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

module.exports = {
    FFmpegArgs: FFmpegArgs,
    FFmpegDefaultArguments: FFmpegDefaultArguments
};
