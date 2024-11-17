const path = require('path');

module.exports = {
    entry: './index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'pritisan',
        libraryTarget: 'umd',
    },
    mode: 'production',
    resolve: {
        fallback: {
            "fs": false,
            "path": require.resolve("path-browserify"),
            "child_process": false,
            "readline": false
        }
    }
};
