const fs = require('fs')
const path = require('path')
const koa = require('koa2')
const Router = require('koa-router')
const koaStatic = require('./build/serve.js')
const serialize = require('serialize-javascript')

const resolve = file => path.resolve(__dirname, file)

const isProd = process.env.NODE_ENV === 'production'
const serverInfo = `koa/${require('koa2/package.json').version}` + `vue-server-renderer/${require('vue-server-renderer/package.json').version}`

const app = new koa()
const router = new Router()
let indexHTML
let renderer

const serve = (url, path, cache) => koaStatic(url, {
    root: resolve(path),
    maxAge: cache && isProd
        ? 60 * 60 * 24 * 30
        : 0
})

if (isProd) {
    renderer = createRenderer(fs.readFileSync(resolve('./dist/server-bundle.js'), 'utf-8'))
    indexHTML = parseIndex(fs.readFileSync(resolve('./dist/index.html'), 'utf-8'))
} else {
    require('./build/setup-dev-server')(app, {
        bundleUpdated: bundle => {
            renderer = createRenderer(bundle)
        },
        indexUpdated: index => {
            indexHTML = parseIndex(index)
        }
    })
}

function createRenderer(bundle) {
    return require('vue-server-renderer').createBundleRenderer(bundle, {
        cache: require('lru-cache')({
            max: 1000,
            maxAge: 1000 * 60 * 15
        })
    })
}

function parseIndex(template) {
    const contentMarker = '<!-- APP -->'
    const i = template.indexOf(contentMarker)
    return {
        head: template.slice(0, i),
        tail: template.slice(i + contentMarker.length)
    }
}

app.use(serve('/service-worker.js', resolve('./dist/servivce-worker.js')))
app.use(serve('/dist', resolve('./dist/')))
app.use(serve('/public', resolve('./public')))

const renderPromise = function(ctx) {
    const res = ctx.res
    const s = Date.now()
    const url = ctx.url
    const context = {
        url: url
    }
    const renderStream = renderer.renderToStream(context)
    return new Promise(function(resolve, reject) {
        renderStream.once('data', () => {
            res.statusCode = 200
            res.write(indexHTML.head)
        })
        renderStream.on('data', chunk => {
            res.write(chunk)
        })
        renderStream.on('end', () => {
            if (context.initialState) {
                res.write(`<script>window.__INSTAL_STATE__=${serialize(context.initialState)}</script>`)
            }
            res.end(indexHTML.tail)
            resolve()
            console.log(`whole request: ${Date.now() - s}ms`)
        })
        renderStream.on('error', err => {
            if (err && err.code === '404') {
                res.statusCode = 404
                res.end('404 | Page Not Found')
                resolve()
                return
            }
            res.statusCode = 500
            res.end('Internal Error 500')
            resolve()
            console.error(`error during render : ${url}`)
            console.error(err)
        })
    })
}

router.get('*', function(ctx, next) {
    if (!renderer) {
        return ctx.body = 'waiting for compilation.. refresh in a moment.'
    }
    ctx.set("Context-Type", "text/html")
    ctx.set("Server", serverInfo)
    return renderPromise(ctx)
})
app.use(router.routes()).use(router.allowedMethods())
const port = process.env.PORT || 8089
app.listen(port, () => {
    console.log(`server started at localhost:${port}`)
})
