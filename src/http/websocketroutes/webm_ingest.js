const FS = require("fs");
const Path = require("path");
const Url = require('url');
const BSON = require('bson');
const {ConsoleLogger, LogLevel} = require("../../logger");
const Helpers = require("../../helpers");
const Logger = new ConsoleLogger("FFMPEG");
const FFmpeg = require("../../ffmpeg");

const VideoWebSocket = require("../videowebsocket");

const _USE_MONGO_BSON = (typeof BSON !== "undefined" && (typeof BSON === "function" || typeof BSON === "object"));

class BinaryJson {
    static _toBytes(input) {
        switch (typeof input) {
            case "string":
                return BinaryJson._toUTF8Array(input);
            case "object":
                return BinaryJson._toUTF8Array(JSON.stringify(input));
            case "function":
                throw new DOMException("Function is not supported");
            default:
                return BinaryJson._toUTF8Array(input.toString());
        }
    }

    static _toUTF8Array(str) {
        str = str.trim();
        const utf8 = [];
        for (let i = 0; i < str.length; i++) {
            let charcode = str.charCodeAt(i);
            if (charcode >= 0x7E) {
                utf8.push(0x7E);
            } else {
                utf8.push(charcode);
            }
            // if (charcode < 0x80) utf8.push(charcode);
            // else if (charcode < 0x800) {
            //     utf8.push(0xc0 | (charcode >> 6),
            //         0x80 | (charcode & 0x3f));
            // } else if (charcode < 0xd800 || charcode >= 0xe000) {
            //     utf8.push(0xe0 | (charcode >> 12),
            //         0x80 | ((charcode >> 6) & 0x3f),
            //         0x80 | (charcode & 0x3f));
            // }
            // // surrogate pair
            // else {
            //     i++;
            //     // UTF-16 encodes 0x10000-0x10FFFF by
            //     // subtracting 0x10000 and splitting the
            //     // 20 bits of 0x0-0xFFFFF into two halves
            //     charcode = 0x10000 + (((charcode & 0x3ff) << 10)
            //         | (str.charCodeAt(i) & 0x3ff));
            //     utf8.push(0xf0 | (charcode >> 18),
            //         0x80 | ((charcode >> 12) & 0x3f),
            //         0x80 | ((charcode >> 6) & 0x3f),
            //         0x80 | (charcode & 0x3f));
            // }
        }
        return Buffer.from(utf8);
    }

    static _tryParseBinaryJson(input) {
        input = BinaryJson._fromUTF8Array(input);
        try {
            if (typeof input === "string") {
                return JSON.parse(input);
            } else if (typeof input === "object") {
                return input;
            }
        } catch (e) {
        }
        return input;
    }

    static _fromUTF8Array(utf8) {
        let output = "";
        for (let i = 0; i < utf8.length; i++) {
            output += String.fromCharCode(utf8[i]);
        }
        return output.trim();
    }

    /**
     * @param {*} data
     * @returns {Buffer}
     */
    static serialize(data) {
        if (_USE_MONGO_BSON) {
            return BSON.serialize(data);
        } else {
            return BinaryJson._toBytes(data);
        }
    }

    /**
     * @param {Uint8Array} data
     * @returns {*}
     */
    static deserialize(data) {
        if (_USE_MONGO_BSON) {
            return BSON.deserialize((data instanceof Uint8Array) ? data : Uint8Array.from(data));
        } else {
            return BinaryJson._tryParseBinaryJson(data);
        }
    }
}

const _HEADER_END = Buffer.from([0x02, 0x0A]);

class WebmIngestWebSocket extends VideoWebSocket {
    constructor() {
        super("webmingest");
        this.ffmpegSessions = [];
    }

    static makeHeader(headerData, payload = null) {
        //TODO remake to use Buffer in Node
        let headerBuffer = BinaryJson.serialize(headerData);
        let payloadSize = 0;
        if (payload) {
            if (typeof payload === "string") {
                payload = Buffer.from(payload, "utf8");
            } else if (Array.isArray(payload)) {
                payload = Buffer.from(payload);
            } else if (typeof payload !== "function") {
                payload = BinaryJson.serialize(payload);
            }
            payloadSize = payload.byteLength;
        }
        let outBuffer = Buffer.alloc(headerBuffer.byteLength + 2 + payloadSize);
        headerBuffer.copy(outBuffer);
        _HEADER_END.copy(outBuffer, headerBuffer.byteLength);
        payload.copy(outBuffer, headerBuffer.byteLength + 2);

        return outBuffer;
    }

    static getHeader(data) {
        const hbytes = [];
        const length = Math.max(data.byteLength - 2, 4096);
        data = Buffer.from(data);
        for (let i = 0; i < length; i++) {
            if (data[i] === 0x02 && data[i + 1] === 0x0A) {
                break;
            } else {
                hbytes.push(data[i]);
            }
        }
        const headerSize = hbytes.length + 2;
        return {
            header: BinaryJson.deserialize(hbytes),
            data: data.slice(headerSize),
            headerSize: headerSize,
            dataSize: (data.byteLength - headerSize),
            rawSize: data.byteLength,
        };
    }

    onConnection(socket, request) {
        socket.binaryType = "arraybuffer";
        request.nmsConnectionType = 'ws';
        request.url = request.url.replace("webmingest", "");

        const socketId = request.headers["sec-websocket-key"];

        const outputUrl = "rtmp://localhost/app/lukix29";
        let firstPacket = [];
        const ffmpegArgs = new FFmpeg.Args([
            {"-rw_timeout": "10000000"},
            {"-hide_banner": ""},
            {"-y": ""},
            {"-re": ""},
            {"-i": "-"},
            {"-c:v": "h264"},
            {"-b:v": "3000k"},
            {"-minrate": "1500k"},
            {"-maxrate": "4350k"},
            {"-bufsize": "8700k"},
            {"-preset": "ultrafast"},
            {"-c:a": "aac"},
            {"-b:a": "128k"},
            {"-f": "flv"},
            {"": outputUrl}
        ]);

        const ffmpeg = new FFmpeg();

        const testFile = Path.resolve("./media/stream.webm");

        socket.on('message', (raw) => {
            try {
                const message = WebmIngestWebSocket.getHeader(raw);

                if (firstPacket.length < 5) {
                    if (firstPacket.length === 0) {
                        const videoBitrate = Math.floor(message.header.videoBitsPerSecond / 1000);
                        ffmpegArgs.set("-b:v", videoBitrate + "k");
                        ffmpegArgs.set("-b:a", Math.floor(message.header.audioBitsPerSecond / 1000) + "k");
                        ffmpegArgs.set("-bufsize", Math.floor((videoBitrate * 1.45) * 2) + "k");
                        ffmpegArgs.set("-minrate", Math.floor(videoBitrate / 2) + "k");
                        ffmpegArgs.set("-maxrate", Math.floor(videoBitrate * 1.45) + "k");
                    }
                    firstPacket.push(message.data);

                    if (firstPacket.length === 5) {
                        firstPacket = Buffer.concat(firstPacket);
                        console.log('Saved start of Stream ' + firstPacket.byteLength);
                        //FS.writeFileSync(testFile, firstPacket, {encoding: "binary"});

                        ffmpeg.write(firstPacket);
                    } else if (firstPacket.length === 1) {
                        ffmpeg.start(ffmpegArgs);
                    }
                } else {
                    ffmpeg.write(message.data);
                    // FS.appendFileSync(testFile, message.data, {encoding: "binary"});
                    //console.log('Socket received ' + message.length + " Bytes");
                }
            } catch (e) {
                console.log("error:", e);
                socket.close();
            }
        });

        socket.on('close', (code, reason) => {
            console.log(`Socket close ${reason} (${code})`);
            ffmpeg.kill();
        });

        socket.on('error', (error) => {
            console.error(`Socket error: ` + JSON.stringify(error, null, 3));
        });
    }
}

module.exports = WebmIngestWebSocket;
