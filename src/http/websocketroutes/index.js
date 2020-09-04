const FS = require("fs");
const Path = require("path");
const Url = require('url');

const Sockets = {};

const curDir = Path.resolve(__dirname);
FS.readdirSync(curDir).forEach((file) => {
    if (Path.extname(file) === ".js" && file.indexOf("index.js") < 0) {
        const socket = require(Path.resolve(Path.join(curDir, file)));
        const name = Path.basename(file, ".js").replace(/_+/gmi, "");
        Sockets[name] = new socket();
    }
});

function onUpgrade(request, socket, head) {
    const pathname = Url.parse(request.url)
        .pathname.replace("/", "")
        .split("/")[0];
    if (Sockets.hasOwnProperty(pathname)) {
        Sockets[pathname].handleUpgrade(request, socket, head, (ws) => {
            Sockets[pathname].emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
}

exports.Sockets = Sockets;
exports.onUpgrade = onUpgrade;
