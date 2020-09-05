const _USE_MONGO_BSON = (typeof BSON !== "undefined" && (typeof BSON === "function" || typeof BSON === "object"));
const _DEBUG = false;

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
        for (var i = 0; i < str.length; i++) {
            var charcode = str.charCodeAt(i);
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
        return utf8;
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
        for (var i = 0; i < utf8.length; i++) {
            output += String.fromCharCode(utf8[i]);
        }
        return output.trim();
    }

    static serialize(data) {
        if (_DEBUG) console.log("Using " + ((_USE_MONGO_BSON ? "MongoDb-Bson" : "Internal") + " Serializer"));
        if (_USE_MONGO_BSON) {
            return Array.from(BSON.serialize(data));
            // console.log("BSON.serialize", data);
            //             // return data;
        } else {
            return BinaryJson._toBytes(data);
        }
    }

    static deserialize(data) {
        if (_DEBUG) console.log("Using " + ((_USE_MONGO_BSON ? "MongoDb-Bson" : "Internal") + " Deserializer"));
        if (_USE_MONGO_BSON) {
            return BSON.deserialize((data instanceof Uint8Array) ? data : Uint8Array.from(data));
        } else {
            return BinaryJson._tryParseBinaryJson(data);
        }
    }
}

class BinaryWebsocket extends WebSocket {
    makeHeader(headerData, payload) {
        let bytes = BinaryJson.serialize(headerData);
        bytes.push(0x02, 0x0A);
        if (payload) bytes.push(...Array.from(new Uint8Array(payload)));
        return new Uint8Array(bytes);
    }

    getHeader(data) {
        const hbytes = [];
        const length = Math.max(data.length - 2, 4096);
        for (let i = 0; i < length; i++) {
            if (data[i] === 0x02 && data[i + 1] === 0x0A) {
                break;
            } else {
                hbytes.push(data[i]);
            }
        }
        return BinaryJson.deserialize(hbytes);
    }

    // test() {
    //     let data = {
    //         input: 4352454234,
    //         fdsf: false,
    //         output: {
    //             file: "./build/RtmpRelayServer.js",
    //             format: 'cjs',
    //             exports: {name: "test2"}
    //         },
    //         plugins: [
    //             "test1",
    //             {name: "test2"}
    //         ]
    //     };
    //
    //     console.log(data);
    //     let binary = this.makeHeader(data);
    //     for (let i = 0; i < Math.pow(2, 16); i++) {
    //         binary.push(Math.rand(0, 255));
    //     }
    //     console.log(binary);
    //     let raw = this.getHeader(binary);
    //     console.log(raw);
    // }

    /**
     * @param {ArrayBuffer} data
     * @param header
     */
    send(data, header = {}) {
        super.send(this.makeHeader(header, data));
    }

    constructor(address, protocols = null) {
        super(address, protocols);

        function onClose(event) {
            //console.log(event.type, event);
        }

        function onOpen(event) {
            //console.log(event.type, event);
        }

        function onError(event) {
            //console.log(event.type, event);
        }

        function onMessage(event) {
            //console.log(event.type, event.data);
        }

        super.addEventListener("message", onMessage);
        super.addEventListener("error", onError);
        super.addEventListener("message", onOpen);
        super.addEventListener("error", onClose);
    }
}

class CodecItem {
    constructor(index, description, videoCodec, audioCodec, videoArgs, defaultBitrates = AvailableCodecs.X264Bitrates, mimeType = null) {
        this.__values = {
            index: index,
            description: description,
            info: {
                videoCodec: videoCodec,
                audioCodec: audioCodec,
                videoArgs: {...videoArgs}
            },
            mime: (typeof mimeType === "string") ? mimeType : `video/x-matroska;codecs="${videoCodec},${audioCodec}"`,
            defaultBitrates: defaultBitrates,
        };
    }

    get index() {
        return this.__values.index;
    }

    get description() {
        return this.__values.description;
    }

    get info() {
        return this.__values.info;
    }

    get videoCodec() {
        return this.__values.info.videoCodec;
    }

    get audioCodec() {
        return this.__values.info.audioCodec;
    }

    get videoArgs() {
        return this.__values.info.videoArgs;
    }

    get mime() {
        return this.__values.mime;
    }

    getBitrate(height, fps) {
        if (this.__values.defaultBitrates.hasOwnProperty(height)) {
            if (this.__values.defaultBitrates[height].length === 1 || fps <= this.__values.defaultBitrates[height][0].fps) {
                return this.__values.defaultBitrates[height][0].bitrate;
            } else if (this.__values.defaultBitrates[height].length > 1 && fps >= this.__values.defaultBitrates[height][0].fps) {
                return this.__values.defaultBitrates[height][1].bitrate;
            }
        }
        return 3000;
    }
}

class AvailableCodecs {
    static calcDivBy2Width(height) {
        let v = Math.round(height * (16.0 / 9.0));
        if (v % 2 !== 0) return v + 1;
        else return v;
    }

    static isSupported(mimeType) {
        const videoElement = document.createElement("video");
        let mimeType4 = mimeType.replace(/video\/[\w-]+;/gmi, "video/mp4;");
        return (MediaRecorder.isTypeSupported(mimeType)
            && MediaSource.isTypeSupported(mimeType4)
            && (videoElement.canPlayType(mimeType4) === "probably"));
    }

    static get X264Bitrates() {
        return {
            240: [
                {fps: 30, bitrate: 300}
            ],
            360: [
                {fps: 30, bitrate: 500}
            ],
            480: [
                {fps: 30, bitrate: 1000}
            ],
            720: [
                {fps: 30, bitrate: 2000},
                {fps: 60, bitrate: 4000}
            ],
            1080: [
                {fps: 30, bitrate: 4000},
                {fps: 60, bitrate: 8000}
            ],
            1440: [
                {fps: 30, bitrate: 8000},
                {fps: 60, bitrate: 16000}
            ],
            2160: [
                {fps: 30, bitrate: 16000},
                {fps: 60, bitrate: 32000}
            ]
        };
    };

    static get Vp9Bitrates() {
        return {
            240: [
                {fps: 30, bitrate: 200}
            ],
            360: [
                {fps: 30, bitrate: 300}
            ],
            480: [
                {fps: 30, bitrate: 800}
            ],
            720: [
                {fps: 30, bitrate: 1100},
                {fps: 60, bitrate: 2000}
            ],
            1080: [
                {fps: 30, bitrate: 2000},
                {fps: 60, bitrate: 3000}
            ],
            1440: [
                {fps: 30, bitrate: 6000},
                {fps: 60, bitrate: 9000}
            ],
            2160: [
                {fps: 30, bitrate: 12000},
                {fps: 60, bitrate: 18000}
            ]
        };
    };

    get values() {
        return this.__codecs.map((t) => t.mime);
    }

    get codecs() {
        return this.__codecs;
    }

    get best() {
        return this.__codecs[0];
    }

    constructor() {

        const vp8Codec = new CodecItem(0, "VP8 / Opus", "vp8", "opus", {level: 0}, this.Vp9Bitrates);

        const vp9Codec = new CodecItem(0, "VP9 / Opus", "vp9", "opus", {level: 0}, this.Vp9Bitrates);

        this.__codecs = [];

        if (AvailableCodecs.isSupported(vp8Codec.mime)) output.push(vp8Codec);
        if (AvailableCodecs.isSupported(vp9Codec.mime)) output.push(vp9Codec);

        const AVC_PROFILES_DESC = [
            {profile_idc: 66, index: 3, description: "Constrained Baseline", constrained_set1_flag: true},
            {profile_idc: 66, index: 4, description: "Baseline"},
            {profile_idc: 77, index: 5, description: "Constrained Main", constrained_set1_flag: true},
            {profile_idc: 77, index: 6, description: "Main"},
            {profile_idc: 100, index: 7, description: "High", constrained_set4_flag: false},

            // {profile_idc: 88,index:1, description: "Extended"},
            // {profile_idc: 100, description: "High Progressive", constrained_set4_flag: true},
            // {profile_idc: 100, description: "Constrained High", constrained_set4_flag: true, constrained_set5_flag: true},
            // {profile_idc: 110, description: "High 10"},
            // {profile_idc: 110, description: "High 10 Intra", constrained_set3_flag: true},
            // {profile_idc: 122, description: "High 4:2:2"},
            // {profile_idc: 122, description: "High 4:2:2 Intra", constrained_set3_flag: true},
            // {profile_idc: 244, description: "High 4:4:4 Predictive"},
            // {profile_idc: 244, description: "High 4:4:4 Intra", constrained_set3_flag: true},
            // {profile_idc: 44, description: "CAVLC 4:4:4 Intra"}
        ];
        const AVC_PROFILES_IDC = [66, 77, 88, 100, 110, 122, 244, 44];
        const AVC_CONSTRAINTS = [0, 4, 8, 16, 32, 64, 128];
        const AVC_LEVELS = [10, 11, 12, 13, 20, 21, 22, 30, 31, 32, 40, 41, 42, 50, 51, 52];

        let i;
        for (let j in AVC_PROFILES_IDC) {
            let sj = AVC_PROFILES_IDC[j].toString(16);
            if (sj.length === 1) sj = "0" + sj;
            for (let k in AVC_CONSTRAINTS) {
                let sk = AVC_CONSTRAINTS[k].toString(16);
                if (sk.length === 1) sk = "0" + sk;

                let desc = "";
                let index = 0;
                for (i in AVC_PROFILES_DESC) {
                    if (AVC_PROFILES_IDC[j] === AVC_PROFILES_DESC[i].profile_idc) {
                        let c = ((AVC_PROFILES_DESC[i].constrained_set0_flag ? 1 : 0) << 7) |
                            ((AVC_PROFILES_DESC[i].constrained_set1_flag ? 1 : 0) << 6) |
                            ((AVC_PROFILES_DESC[i].constrained_set2_flag ? 1 : 0) << 5) |
                            ((AVC_PROFILES_DESC[i].constrained_set3_flag ? 1 : 0) << 4) |
                            ((AVC_PROFILES_DESC[i].constrained_set4_flag ? 1 : 0) << 3) |
                            ((AVC_PROFILES_DESC[i].constrained_set5_flag ? 1 : 0) << 2);
                        if (c === AVC_CONSTRAINTS[k]) {
                            desc = AVC_PROFILES_DESC[i].description;
                            index = AVC_PROFILES_DESC[i].index;
                            break;
                        }
                    }
                }
                if (desc.length > 0) {
                    for (let l in AVC_LEVELS) {
                        let sl = AVC_LEVELS[l].toString(16);
                        if (sl.length === 1) sl = "0" + sl;
                        let mimeX = 'video/x-matroska;codecs="avc1.' + sj + sk + sl + ',opus"';
                        //let mime4 = 'video/mp4;codecs="avc1.' + sj + sk + sl + ',opus"';
                        if (AvailableCodecs.isSupported(mimeX)) {
                            const level = AVC_LEVELS[l] / 10;
                            this.__codecs.push(new CodecItem(index * AVC_LEVELS[l], `H264 ${desc} ${level} / Opus`,
                                "h264", "opus", {
                                    level: level,
                                    IDC: AVC_PROFILES_IDC[j],
                                    constraints: AVC_CONSTRAINTS[k]
                                }, AvailableCodecs.X264Bitrates, mimeX));
                        }
                    }
                }
            }
        }

        this.__codecs.sort((a, b) => b.index - a.index);
    }
}

const codecs = new AvailableCodecs();
const CODEC = codecs.best;

const FPS = 30;
const Height = 480;
const Width = AvailableCodecs.calcDivBy2Width(Height);

const ChunkLength = 1000;
const VideoBitrate = CODEC.getBitrate(Height, FPS);//kbit/s
const AudioBitrate = 96;//kbit/s
const AllByterate = (VideoBitrate * 1000 + AudioBitrate * 1000) / 8;

let videoChunkHeader = {
    chunkLength: ChunkLength,
    codec: CODEC.info,
    mimeType: CODEC.mime,
    fps: FPS,
    videoBitsPerSecond: Math.floor(VideoBitrate * 1000),
    audioBitsPerSecond: Math.floor(AudioBitrate * 1000),
};

console.log(codecs);

let recorderStartTime = performance.now();
let frameCount = 0;
let sentBytes = 0;
let bytesPerSecond = 0;

/*    function drawWhiteNoise() {
        var offset = 0;

        var pixels = ctx.getImageData(0, 0, width, height);

        var data = pixels.data;
        var numPixels = data.length;

        for (var i = 0; i < numPixels; i++) {
            var grey = Math.round(Math.random() * 126);

            // The data array has pixel values in RGBA order
            // (Red, Green, Blue and Alpha for transparency)
            // We will make R, G and B have the same value ('grey'),
            // then skip the Alpha value by increasing the offset,
            // as we're happy with the opaque value we set when painting
            // the background black at the beginning
            data[offset++] = grey;
            data[offset++] = grey;
            data[offset++] = grey;
            offset++; // skip the alpha component
        }
        // And tell the context to draw the updated pixels in the canvas
        ctx.putImageData(pixels, 0, 0);
    }

    function updateBuffer() {
        // if (queue.length > 0 && !sourceBuffer.updating) {
        //     sourceBuffer.appendBuffer(queue.shift());
        // }
    }*/

function CanvasTestFrame(ctx, width, height) {
    const yStartOffset = Math.floor(width / 28);

    const textColor = "#e1e1e1";
    ctx.fillStyle = textColor;
    ctx.font = (yStartOffset - 8) + 'px monospace';
    ctx.textAlign = "center";

    let captureTimer = null;
    let recorderStartTime = performance.now();

    ctx.fillText("Click here to start Rendering", width / 2, height / 2);

    let deltaT = 0;
    let n0 = performance.now();
    let n1 = 0;
    let curFps = 0;
    let maxTextWidth = 15;

    let statsCurX = 0;
    let maxStatsHeight = height * 0.35;

    let statItems = {
        bytesPerSecond: "rgba(255, 0, 255, 1)",
        deltaT: "rgba(0, 255, 255, 1)",
        curFps: "rgba(0, 255, 0, 1)"
    };

    function drawStatItem(value, inMin, inMax, rgba = [126, 126, 126, 1.0]) {

        let h = Math.floor(Math.min(maxStatsHeight, Math.map(value, inMin, inMax, 0, maxStatsHeight)));
        if (typeof rgba !== "string") {
            if (rgba.length < 4) rgba.push(1.0);
            ctx.fillStyle = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
        } else {
            ctx.fillStyle = rgba;
        }
        ctx.fillRect(statsCurX, height - h, 1, 2);

        return h;
    }

    function drawTriangle(x, y, w, h) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);

        ctx.lineTo((x + (w / 2)) + 1, y + h);

        ctx.lineTo(x + (w / 2) + 1, height);
        ctx.lineTo(x + (w / 2) - 1, height);

        ctx.lineTo((x + (w / 2)) - 1, y + h);

        ctx.fill();
    }

    function drawStatsView(yi) {
        if (maxStatsHeight < yi) maxStatsHeight = yi;

        ctx.fillStyle = "#000000";
        ctx.fillRect(statsCurX, height - maxStatsHeight, 2, maxStatsHeight);

        ctx.fillStyle = "#a2a2a2";
        ctx.fillRect(0, (height - maxStatsHeight) - 3, width, 2);

        // ctx.fillStyle = "#610000";
        // ctx.fillRect(statsCurX + 1, height - maxStatsHeight - 2, 1, maxStatsHeight);

        ctx.fillStyle = "#920000";
        drawTriangle(statsCurX - 3, height - maxStatsHeight - 14, 10, 10);

        drawStatItem(bytesPerSecond, 0, AllByterate, statItems.bytesPerSecond);
        drawStatItem(deltaT, 0, (1000 / FPS), statItems.deltaT);
        drawStatItem(curFps, 0, FPS * 1.5, statItems.curFps);

        statsCurX++;
        if (statsCurX >= width) {
            statsCurX = 0;
        }
        // }
    }

    function drawText(text, y, color = textColor) {
        ctx.fillStyle = color;
        ctx.fillText(text, 20, y);
        y += yStartOffset;
        if (text.length > maxTextWidth) maxTextWidth = text.length;
        return y;
    }

    function drawTestFrame() {
        n1 = n0;
        n0 = performance.now();
        if (captureTimer) clearTimeout(captureTimer);

        // const rgb = Math.floor(Math.min(1.0, deltaT) * 64);
        // pixels.data[offsetPixels++] = rgb;
        // pixels.data[offsetPixels++] = rgb;
        // pixels.data[offsetPixels++] = rgb;
        // offsetPixels++;
        //
        // if (offsetPixels >= pixels.length) {
        //     ctx.fillStyle = '#000000';
        //     ctx.fillRect(0, 0, width, height);
        //     pixels = ctx.getImageData(0, 0, width, height);
        //     offsetPixels = 0;
        // }
        //
        //ctx.putImageData(pixels, 0, 0);

        frameCount++;
        let y = yStartOffset;

        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        ctx.fillRect(0, 0, width, height - maxStatsHeight);

        y = drawText("Time:    " + new Date().toShortTimeString(true), y);
        y = drawText("Runtime: " + formatTime((n0 - recorderStartTime) / 1000), y);
        y = drawText("Draw:    " + (deltaT).toFixed(1) + "ms", y, statItems.deltaT);
        y = drawText("Fps:     " + curFps.toFixed(1), y, statItems.curFps);
        y = drawText("Frames:  " + numeral(frameCount).format(frameCount > 1000 ? "0.00a" : "0"), y);
        y = drawText("Bytes/s: " + numeral(bytesPerSecond).format("0.00ib") + "/s", y, statItems.bytesPerSecond);
        y = drawText("Sent:    " + (sentBytes > 0 ? numeral(sentBytes).format("0.00ib") : "(Click on Start)"), y);

        drawStatsView(y - yStartOffset);

        deltaT = performance.now() - n0;
        curFps = (1000 / ((n0 - n1) - deltaT));
        let dT = Math.floor(Math.max(10, (1000 / FPS) - deltaT));
        if (shouldStop === false) captureTimer = setTimeout(drawTestFrame, dT);
    }

    let shouldStop = false;
    let _isRunning = false;

    this.isRunning = function () {
        return _isRunning;
    };

    const _stop = this.stop = function () {
        if (captureTimer) clearTimeout(captureTimer);
        shouldStop = true;
        _isRunning = false;
        recorderStartTime = performance.now();

        deltaT = 0;
        n0 = performance.now();
        n1 = 0;
        curFps = 0;
        maxTextWidth = 15;

        statsCurX = 0;
        maxStatsHeight = height * 0.35;
    };

    this.start = function () {
        _stop();
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "start";
        shouldStop = false;
        _isRunning = true;
        drawTestFrame();
    };
}

window.onload = () => {
    //MediaSource.isTypeSupported('video/mp4;codecs="vp09.00.10.08');

    const canvas = document.getElementById('drawing');

    canvas.setAttribute("width", Width);
    canvas.setAttribute("height", Height);

    canvas.style.width = Width + "px";
    canvas.style.height = Height + "px";

    const wsEvents = {
        close: (event) => {
            //console.log(event.type, event.srcElement);
            if (mediaRecorder) mediaRecorder.stop();
        },
        error: (event) => {
            //console.log(event.type, event.srcElement);
        },
        message: (event) => {
            // console.log(event.type, event.data);
        },
        open: (event) => {
            // console.log(event.type, event.srcElement);
            StartStream();
        },
        ping: (event) => {
            // console.log(event.type, event.srcElement);
        }
    };

    var ws = null;

    var mediaRecorder = null;
    // var mediaSource = null;
    // var sourceBuffer = null;
    // var queue = [];


    const width = canvas.width;
    const height = canvas.height;
    const start_button = document.getElementById("startstream");

    // const preview = document.getElementById("output");
    // const video = document.getElementById("webcam");

    const ctx = canvas.getContext('2d');

    const testFrameRenderer = new CanvasTestFrame(ctx, width, height, FPS);

    function audioTest() {
        var cStream,
            aStream,
            vid,
            recorder,
            analyser,
            dataArray,
            bufferLength,
            chunks = [];

        function clickHandler() {

            this.textContent = 'stop recording';
            cStream = canvas.captureStream(30);
            cStream.addTrack(aStream.getAudioTracks()[0]);

            recorder = new MediaRecorder(cStream);
            recorder.start();

            recorder.ondataavailable = saveChunks;

            recorder.onstop = exportStream;

            this.onclick = stopRecording;

        };

        function exportStream(e) {

            if (chunks.length) {

                var blob = new Blob(chunks)
                var vidURL = URL.createObjectURL(blob);
                var vid = document.createElement('video');
                vid.controls = true;
                vid.src = vidURL;
                vid.onend = function () {
                    URL.revokeObjectURL(vidURL);
                }
                document.body.insertBefore(vid, canvas);

            } else {

                document.body.insertBefore(document.createTextNode('no data saved'), canvas);

            }
        }

        function saveChunks(e) {

            e.data.size && chunks.push(e.data);

        }

        function stopRecording() {

            vid.pause();
            this.parentNode.removeChild(this);
            recorder.stop();

        }

        function initAudioStream(evt) {

            var audioCtx = new AudioContext();
            // create a stream from our AudioContext
            var dest = audioCtx.createMediaStreamDestination();
            aStream = dest.stream;
            // connect our video element's output to the stream
            var sourceNode = audioCtx.createMediaElementSource(this);
            sourceNode.connect(dest)
            // start the video
            this.play();

            // just for the fancy canvas drawings
            analyser = audioCtx.createAnalyser();
            sourceNode.connect(analyser);

            analyser.fftSize = 2048;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(dataArray);

            // output to our headphones
            sourceNode.connect(audioCtx.destination)

            startCanvasAnim();

            rec.onclick = clickHandler;
            rec.disabled = false;
        };

        var loadVideo = function () {

            vid = document.createElement('video');
            vid.crossOrigin = 'anonymous';
            vid.oncanplay = initAudioStream;
            vid.src = 'https://dl.dropboxusercontent.com/s/bch2j17v6ny4ako/movie720p.mp4';


        }

        function startCanvasAnim() {
            // from MDN https://developer.mozilla.org/en/docs/Web/API/AnalyserNode#Examples
            var canvasCtx = canvas.getContext('2d');

            canvasCtx.fillStyle = 'rgb(200, 200, 200)';
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

            var draw = function () {

                var drawVisual = requestAnimationFrame(draw);

                analyser.getByteTimeDomainData(dataArray);

                canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
                canvasCtx.beginPath();

                var sliceWidth = canvas.width * 1.0 / bufferLength;
                var x = 0;

                for (var i = 0; i < bufferLength; i++) {

                    var v = dataArray[i] / 128.0;
                    var y = v * canvas.height / 2;

                    if (i === 0) {
                        canvasCtx.moveTo(x, y);
                    } else {
                        canvasCtx.lineTo(x, y);
                    }

                    x += sliceWidth;
                }

                canvasCtx.lineTo(canvas.width, canvas.height / 2);
                canvasCtx.stroke();

            };

            draw();

        }

        loadVideo();
    }

    function StartStream() {
        let mediaStream = canvas.captureStream(FPS);

        mediaRecorder = new MediaRecorder(mediaStream, {
            mimeType: videoChunkHeader.mimeType,
            videoBitsPerSecond: videoChunkHeader.videoBitsPerSecond,
            audioBitsPerSecond: videoChunkHeader.audioBitsPerSecond
        });
        mediaRecorder.videoBitsPerSecond = 1000 * 1000;

        console.dir(mediaStream);

        let lastDataRequest = 0;
        let currentChunkLength = ChunkLength;
        let dataRequestTimer = 0;
        let lastSentBytes = 0;

        function calcBytesPerSecond() {
            //const p0 = performance.now();
            if ((sentBytes - lastSentBytes) > 0) {
                bytesPerSecond = (sentBytes - lastSentBytes) * (1000 / ChunkLength);
                // bpsAvg += (sentBytes - lastSentBytes);
                lastSentBytes = sentBytes;
                // bpsAvgCnt++;
                // if (bpsAvgCnt >= 10) {
                //     bytesPerSecond = (bpsAvg / bpsAvgCnt) * 10;
                //     bpsAvgCnt = 0;
                //     bpsAvg = 0;
                // }
            }
            //bpsTimer = setTimeout(calcBytesPerSecond, Math.max(1, interval - (performance.now() - p0)), interval);
        }

        //calcBytesPerSecond(10);
        function requestData() {
            if (mediaRecorder) mediaRecorder.requestData();
            lastDataRequest = performance.now();
        }

        mediaRecorder.addEventListener('dataavailable', (e) => {
            e.data.arrayBuffer().then((data) => {
                if (ws.readyState === WebSocket.OPEN) {
                    videoChunkHeader.chunkLength = currentChunkLength;
                    videoChunkHeader.chunkSize = data.byteLength;

                    ws.send(data, videoChunkHeader);

                    sentBytes += data.byteLength;
                    calcBytesPerSecond();

                    currentChunkLength = Math.max(1, ChunkLength - Math.floor((performance.now() - lastDataRequest) + 0.5));
                    dataRequestTimer = setTimeout(requestData, currentChunkLength);
                }
            }).catch(console.error);
        });

        mediaRecorder.addEventListener("stop", (e) => {
            if (dataRequestTimer) clearTimeout(dataRequestTimer);
            ws.close();
        });

        mediaRecorder.start(0);

        dataRequestTimer = setTimeout(requestData, ChunkLength);

        recorderStartTime = performance.now();
        frameCount = 0;

        // mediaSource = new MediaSource();
        // preview.src = URL.createObjectURL(mediaSource);
        // //preview.play();
        //
        // mediaSource.addEventListener("sourceopen", function () {
        //     sourceBuffer = mediaSource.addSourceBuffer(decodeMime);
        //     sourceBuffer.mode = 'sequence';
        //     console.log("sourceopen", sourceBuffer);
        //
        //     sourceBuffer.addEventListener('updateend', function () {
        //         console.log("updateend");
        //         updateBuffer();
        //     });
        //     sourceBuffer.addEventListener('update', function () { // Note: Have tried 'updateend'
        //         console.log('update');
        //         updateBuffer();
        //     });
        // });
        //
        // mediaSource.addEventListener('sourceended', function () {
        //     console.log("source ended");
        // });
        // mediaSource.addEventListener("sourceclose", function () {
        //     console.log("source closed");
        // });
    }

    start_button.onclick = () => {
        testFrameRenderer.start();
        ws = new BinaryWebsocket("ws://localhost/webmingest/");
        // ws.test();
        ws.binaryType = "arraybuffer";
        for (let event in wsEvents) {
            ws.addEventListener(event, wsEvents[event]);
        }
        start_button.value = "Stop Stream";
        console.log("Started capture");

        start_button.onclick = () => {
            mediaRecorder.stop();
            testFrameRenderer.stop();
            start_button.value = "Start Stream";
            mediaRecorder = null;
            console.log("Stopped capture");
        };
    };

    canvas.addEventListener("click", () => {
        if (testFrameRenderer.isRunning()) {
            testFrameRenderer.stop();
        } else {
            testFrameRenderer.start();
        }
    });
};

Math.rand = function (min, max) {
    return (Math.random() * (max - min)) + min;
};

Math.map = function (x, inMin, inMax, outMin, outMax) {
    return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

Math.roundTo = function (x, fractions) {
    if (fractions % 10 !== 0) fractions = Math.pow(10, fractions);
    if (x > 1.0) x /= 1000.0;
    return Math.floor((x - Math.floor(x)) * fractions);
};

Date.prototype.toShortDateString = function () {
    let h = this.getDay();
    if (h < 10) h = `0${h}`;
    let m = this.getMonth();
    if (m < 10) m = `0${m}`;
    let s = this.getFullYear();
    if (s < 10) s = `0${s}`;
    return `${h}.${m}.${s}`;
};

Date.prototype.toShortTimeString = function (withMilliseconds = false, millisecondFractions = 10) {
    let h = this.getHours();
    if (h < 10) h = `0${h}`;
    let m = this.getMinutes();
    if (m < 10) m = `0${m}`;
    let s = this.getSeconds();
    if (s < 10) s = `0${s}`;

    let ms = "";
    if (withMilliseconds) {
        ms = `.${Math.roundTo(this.getMilliseconds(), millisecondFractions)}`;
        //if (millisecondFractions % 10 !== 0)
        //     millisecondFractions = Math.pow(10, millisecondFractions);
        //ms = this.getMilliseconds() / 1000;
        //ms = Math.floor(ms * millisecondFractions);
        //ms = `.${ms}`;
    }

    return `${h}:${m}:${s}${ms}`;
};

Date.prototype.toShortString = function (withMilliseconds = false) {
    return this.toShortTimeString(withMilliseconds) + " " + this.toShortDateString();
};

String.create = function (char, length) {
    let out = "";
    for (let i = 0; i < length; i++) {
        out += char;
    }
    return out;
};

function formatTime(timeInSeconds, millisecondFractions = 10) {
    let hours = Math.floor(timeInSeconds / 3600);
    let minutes = Math.floor((timeInSeconds - (hours * 3600)) / 60);
    let seconds = Math.floor(timeInSeconds - ((hours * 3600) + (minutes * 60)));

    let millis = Math.roundTo(timeInSeconds - Math.floor(timeInSeconds), millisecondFractions);

    hours = ((hours < 10) ? "0" + hours : hours);
    minutes = ((minutes < 10) ? "0" + minutes : minutes);
    seconds = ((seconds < 10) ? "0" + seconds : seconds);

    return `${hours}:${minutes}:${seconds}.${millis}`;
}
