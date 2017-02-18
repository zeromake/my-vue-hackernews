const path = require('path')
const webpack = require('webpack')
const MFS = require('memory-fs')
const clientConfig = require('./webpack.client.config')
const serverConfig = require('./webpack.server.config')

module.exports = function setupDevServer (app, opts) {
    clientConfig.entry.app = ['webpack-hot-middleware/client', clientConfig.entry.app]
    clientConfig.output.filename = '[name].js'
    clientConfig.plugins.push(
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoEmitOnErrorsPlugin()
    )

    // dev middlemare
    const clientCompiler = webpack(clientConfig)
    const devMiddleware = require('webpack-dev-middleware')(clientCompiler, {
        publicPath: clientConfig.output.publicPath,
        stats: {
            colors: true,
            chunks: false
        }
    })
    app.use(devMiddleware)
    clientCompiler.plugin('done', () => {
        const fs = devMiddleware.fileSystem
        const filePath = path.join(clientConfig.output.path, 'index.html')
        fs.stat(filePath, (err, stats) => {
            if (stats && stats.isFile()){
                fs.readFile(filePath, 'utf-8', (err, data) => {
                    opts.indexUpdated(data)
                })
            } else {
                console.error(err)
            }
        })
    })
    app.use(require('webpack-hot-middleware')(clientCompiler))

    const serverCompiler = webpack(serverConfig)
    const mfs = new MFS()
    const outputPath = path.join(serverConfig.output.path, serverConfig.output.filename)
    serverCompiler.outputFileSystem = mfs
    serverCompiler.watch({}, (err, stats) => {
        if (err) throw err
        stats = stats.toJson()
        stats.errors.forEach(err => console.error(err))
        stats.warnings.forEach(err => console.warn(err))
        mfs.readFile(outputPath, 'utf-8', (err, data) => {
            opts.bundleUpdated(data)
        })
    })
}