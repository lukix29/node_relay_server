// const XXHash = require('xxhash');
// const xxHashSeed = 0xB16B00B5;

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
        // for (let keyA in a) {
        //     if (!a.hasOwnProperty(keyA)) continue;
        //
        //     if (!b.hasOwnProperty(keyA)) return false;
        //     if ((strict ? (a[keyA] !== b[keyA]) : (a[keyA] != b[keyA]))) return false;
        // }
        // return true;

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

module.exports = helpers;
