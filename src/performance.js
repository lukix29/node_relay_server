const __perf_base_time = Math.floor(process.hrtime()[0]);

module.exports.now = () => {
    return Math.floor(process.hrtime()[0] - __perf_base_time);
};