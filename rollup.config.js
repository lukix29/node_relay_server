import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import rollup_cleanup from 'rollup-plugin-cleanup';
import rollup_json from '@rollup/plugin-json';

export default {
    input: "./src/relayserver.js",
    output: {
        file: "./build/RtmpRelayServer.js",
        format: 'cjs',
        exports: "named"
    },
    plugins: [
        nodeResolve({
            jsnext: true,
            main: true
        }),
        commonjs(),
        rollup_json(),
        rollup_cleanup({
            comments: "none",
            sourcemap: false
        })
    ]
}
