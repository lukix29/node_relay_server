const Helpers = require("./helpers");

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
            args = args.filter((t) => !Helpers.isEmptyObject(t));
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

module.exports = {
    ConsoleLogger: ConsoleLogger,
    LogLevel: LogLevel
};
