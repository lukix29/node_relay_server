const {InternalEventHandler, GlobalEventHandler, EventItem, Event, EventsCache} = require("./event_handler");

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
        return new EventItem("info", "RtmpServerEvents");
    }

    static get Started() {
        return new EventItem("started", "RtmpServerEvents");
    }

    static get Connection() {
        return new EventItem("connection", "RtmpServerEvents");
    }

    static get Error() {
        return new EventItem("error", "RtmpServerEvents");
    }

    static get Close() {
        return new EventItem("close", "RtmpServerEvents");
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
        return new EventItem("error", "RtmpRelayEvents");
    }

    static get Auth() {
        return new EventItem("auth", "RtmpRelayEvents");
    }

    static get PublishEnd() {
        return new EventItem("publishend", "RtmpRelayEvents");
    }

    static get Connect() {
        return new EventItem("connect", "RtmpRelayEvents");
    }

    static get Publish() {
        return new EventItem("publish", "RtmpRelayEvents");
    }

    static get Disconnect() {
        return new EventItem("disconnect", "RtmpRelayEvents");
    }

    static get Close() {
        return new EventItem("close", "RtmpRelayEvents");
    }

    constructor() {
    }
}

class RtmpSessionEvents {
    static get AllEvents() {
        return [
            RtmpSessionEvents.SocketClose,//  "close",
            RtmpSessionEvents.DoneConnect,//"doneConnect",
            RtmpSessionEvents.PreConnect,//"preConnect",
            RtmpSessionEvents.PostConnect,// "postConnect",
            RtmpSessionEvents.PrePublish,// "prePublish",
            RtmpSessionEvents.PostPublish,// "postPublish",
            RtmpSessionEvents.PrePlay,// "prePlay",
            RtmpSessionEvents.PostPlay,// "postPlay",
            RtmpSessionEvents.DonePlay,// "donePlay",
            RtmpSessionEvents.DonePublish,// "donePublish",
        ]
    }

    static get SocketClose() {
        return new EventItem("close", "RtmpSessionEvents");
    }

    static get DoneConnect() {
        return new EventItem("doneConnect", "RtmpSessionEvents");
    }

    static get PreConnect() {
        return new EventItem("preConnect", "RtmpSessionEvents");
    }

    static get PostConnect() {
        return new EventItem("postConnect", "RtmpSessionEvents");
    }

    static get PrePublish() {
        return new EventItem("prePublish", "RtmpSessionEvents");
    }

    static get PostPublish() {
        return new EventItem("postPublish", "RtmpSessionEvents");
    }

    static get PrePlay() {
        return new EventItem("prePlay", "RtmpSessionEvents");
    }

    static get PostPlay() {
        return new EventItem("postPlay", "RtmpSessionEvents");
    }

    static get DonePlay() {
        return new EventItem("donePlay", "RtmpSessionEvents");
    }

    static get DonePublish() {
        return new EventItem("donePublish", "RtmpSessionEvents");
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
        return new EventItem("starting", "FFmpegEvents");
    };

    static get Started() {
        return new EventItem("started", "FFmpegEvents");
    };

    static get Error() {
        return new EventItem("error", "FFmpegEvents");
    };

    static get Stdout() {
        return new EventItem("stdout", "FFmpegEvents");
    };

    static get Stderr() {
        return new EventItem("stderr", "FFmpegEvents");
    };

    static get Close() {
        return new EventItem("close", "FFmpegEvents");
    };

}

class FlvSessionEvents {
    static get PreConnect() {
        return new EventItem("preConnect", "FlvSessionEvents");
    }

    static get PostConnect() {
        return new EventItem("postConnect", "FlvSessionEvents");
    }

    static get DoneConnect() {
        return new EventItem("doneConnect", "FlvSessionEvents");
    }

    static get PrePlay() {
        return new EventItem("prePlay", "FlvSessionEvents");
    }

    static get PostPlay() {
        return new EventItem("postPlay", "FlvSessionEvents");
    }

    static get DonePlay() {
        return new EventItem("donePlay", "FlvSessionEvents");
    }

}

module.exports = {
    InternalEventHandler: InternalEventHandler,
    EventHandler: GlobalEventHandler,
    EventItem: EventItem,
    Event: Event,
    EventsCache: EventsCache,

    RtmpServerEvents: RtmpServerEvents,
    RtmpRelayEvents: RtmpRelayEvents,
    RtmpSessionEvents: RtmpSessionEvents,
    FFmpegEvents: FFmpegEvents,
    FlvSessionEvents: FlvSessionEvents
};
