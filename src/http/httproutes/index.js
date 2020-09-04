const Helpers = require("../../helpers");
const FS = require("fs");
const Path = require("path");

module.exports.Routes = [];

const curDir = Path.resolve(__dirname);
FS.readdirSync(curDir).forEach((file) => {
    if (Path.extname(file) === ".js" && file.indexOf("index.js") < 0) {
        const route = require(Path.resolve(Path.join(curDir, file)));
        const name = Path.basename(file, ".js").toCamelCase() + "Route";
        module.exports[name] = route;
        module.exports.Routes.push({router: route, path: route.defaultPath});
    }
});
