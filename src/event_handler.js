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
        // console.log("Internal > { " + eventName.base + " : " + eventName.name + " }");

        if (this._events.hasOwnProperty(base) && this._events[base].hasOwnProperty(name)) {
            let results = [];
            this._events[base][name].forEach((event, index) => {
                if (event) {
                    // let res = GlobalEventHandler.emit(event, ...data);
                    // if (res) {
                    //     results.push(res);
                    // }
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
        // console.log("Global   > { " + eventName.base + " : " + eventName.name + " }");

        if (EventsCache.hasOwnProperty(base)) {
            if (EventsCache[base].hasOwnProperty(name)) {
                let results = [];
                EventsCache[base][name].forEach((event, index) => {
                    if (event) {
                        results.push(event.callback(...data));
                        if (event.once) {
                            //TODO delete once events
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
            // if (this.AllowedEvents.length === 0 || this.AllowedEvents.includes(event.name)) {
            addToCache(event, callback, once);
            return true;
            // }
            // return false;
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

module.exports = {
    InternalEventHandler: InternalEventHandler,
    EventHandler: GlobalEventHandler,
    EventItem: EventItem,
    Event: Event,
    EventsCache: EventsCache
};
