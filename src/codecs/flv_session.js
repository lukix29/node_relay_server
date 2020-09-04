const URL = require("url");
//const AMF = require("../rtmp/core_amf");
const {ConsoleLogger} = require("../logger");
const {EventHandler, InternalEventHandler, FlvSessionEvents} = require("../events");
const context = require("../rtmp/core_ctx");
const NodeCoreUtils = require("../rtmp/core_utils");
const Logger = new ConsoleLogger();

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

class FlvSession extends InternalEventHandler {
    constructor(req, res) {
        super();
        this.req = req;
        this.res = res;
        this.id = NodeCoreUtils.generateNewSessionID();
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
        context.sessions.set(this.id, this);
    }

    run() {
        let method = this.req.method;
        let urlInfo = URL.parse(this.req.url, true);
        let streamPath = urlInfo.pathname.split(".")[0];
        this.connectCmdObj = {ip: this.ip, method, streamPath, query: urlInfo.query};
        this.connectTime = new Date();
        this.isStarting = true;
        console.log(`[${this.TAG} connect] id=${this.id} ip=${this.ip} url=${this.req.url} streamPath=${streamPath.replace(/^\//gmi, "")}`);
        this.emit(FlvSessionEvents.PreConnect, this.id, this.connectCmdObj);
        if (!this.isStarting) {
            this.stop();
            return;
        }
        this.emit(FlvSessionEvents.PostConnect, this.id, this.connectCmdObj);
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
            let publisherId = context.publishers.getName(this.playStreamPath);
            if (publisherId != null) {
                context.sessions.get(publisherId).players.delete(this.id);
                this.emit(FlvSessionEvents.DonePlay, this.id, this.playStreamPath, this.playArgs);
            }
            Logger.log(`[${this.TAG} play] Close stream. id=${this.id} streamPath=${this.playStreamPath}`);
            Logger.log(`[${this.TAG} disconnect] id=${this.id}`);
            this.emit(FlvSessionEvents.DoneConnect, this.id, this.connectCmdObj);
            this.res.end();
            context.idlePlayers.delete(this.id);
            context.sessions.delete(this.id);
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
        Logger.log(`[${this.TAG} reject] id=${this.id}`);
        this.stop();
    }

    onPlay() {
        // console.log(this.playStreamPath, context.publishers);
        this.emit(FlvSessionEvents.PrePlay, this.id, this.playStreamPath, this.playArgs);
        if (!this.isStarting) {
            return;
        }

        //TODO
        // if (this.config.auth !== undefined && this.config.auth.play) {
        //     let results = NodeCoreUtils.verifyAuth(this.playArgs.sign, this.playStreamPath, this.config.auth.secret);
        //     if (!results) {
        //         Logger.log(`[${this.TAG} play] Unauthorized. id=${this.id} streamPath=${this.playStreamPath} sign=${this.playArgs.sign}`);
        //         this.res.statusCode = 403;
        //         this.res.end();
        //         return;
        //     }
        // }

        if (!context.publishers.hasName(this.playStreamPath)) {
            Logger.log(`[${this.TAG} play] Stream not found. id=${this.id} streamPath=${this.playStreamPath} `);
            context.idlePlayers.add(this.id);
            this.isIdling = true;
            return;
        }

        this.onStartPlay();
    }

    onStartPlay() {
        let publisherId = context.publishers.getName(this.playStreamPath);

        let publisher = context.sessions.get(publisherId);
        let players = publisher.players;
        players.add(this.id);

        //send FLV header
        let FLVHeader = Buffer.from([0x46, 0x4c, 0x56, 0x01, 0x00, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00]);
        if (publisher.isFirstAudioReceived) {
            FLVHeader[4] |= 0b00000100;
        }

        if (publisher.isFirstVideoReceived) {
            FLVHeader[4] |= 0b00000001;
        }
        this.res.write(FLVHeader);

        //send Metadata
        if (publisher.metaData != null) {
            let packet = FlvPacket.create(publisher.metaData, 18);
            let tag = FlvSession.createFlvTag(packet);
            this.res.write(tag);
        }

        //send aacSequenceHeader
        if (publisher.audioCodec == 10) {
            let packet = FlvPacket.create(publisher.aacSequenceHeader, 8);
            let tag = FlvSession.createFlvTag(packet);
            this.res.write(tag);
        }

        //send avcSequenceHeader
        if (publisher.videoCodec == 7 || publisher.videoCodec == 12) {
            let packet = FlvPacket.create(publisher.avcSequenceHeader, 9);
            let tag = FlvSession.createFlvTag(packet);
            this.res.write(tag);
        }

        //send gop cache
        if (publisher.flvGopCacheQueue != null) {
            for (let tag of publisher.flvGopCacheQueue) {
                this.res.write(tag);
            }
        }

        this.isIdling = false;
        this.isPlaying = true;
        Logger.log(`[${this.TAG} play] Join stream. id=${this.id} streamPath=${this.playStreamPath} `);
        this.emit(FlvSessionEvents.PostPlay, this.id, this.playStreamPath, this.playArgs);
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

module.exports = FlvSession;
