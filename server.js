const fs = require('fs')
const path = require('path')
const Koa = require('koa')
const KoaRuoter = require('koa-router')
const KoaServe = require('./build/serve')
const serialize = require('serialize-javascript')

const resolve = file => path.resolve(__dirname, file)

const isProd = process.env.NODE_ENV === 'production'
const serverInfo = `koa/${require('koa/package.json').version}` +
    `vue-server-renderer/${require('vue-server-renderer/package.json').version}`

const app = new Koa()
const router = new KoaRuoter()


const serve = (url, path, cache) => KoaServe(url, {
    root: resolve(path),
    maxAge: cache && isProd ? 60 * 60 * 24 * 30 : 0
})

// 模拟api
app.use(serve('/api/topstories.json', './public/api/topstories.json'))
app.use(serve('/api/newstories.json', './public/api/newstories.json'))
router.get('/api/item/:id.json', (ctx, next) => {
    const id = ctx.params.id
    const time = parseInt(Math.random() * (1487396700 - 1400000000 + 1) + 1400000000)
    const item = {
        by: 'zero' + id,
        descendants: 0,
        id: id,
        score: id - 13664000,
        time: time,
        title: `测试Item:${id} - ${time}`,
        type: 'story',
        url: `/api/item/${id}.json`

    }
    ctx.body = item
})

let indexHTML
let renderer
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

function createRenderer (bundle) {
    return require('vue-server-renderer').createBundleRenderer(bundle, {
        cache: require('lru-cache')({
            max: 1000,
            maxAge: 1000 * 60 * 15
        })
    })
}

function parseIndex (template) {
    const contentMarker = '<!-- APP -->'
    const i = template.indexOf(contentMarker)
    return {
        head: template.slice(0, i),
        tail: template.slice(i + contentMarker.length)
    }
}

// 加载和设置static
// app.use(compression({ threshold: 0}))
// app.use(favicon('./public/logo-48.png'))
app.use(serve('/service-worker.js', './dist/servivce-worker.js'))
app.use(serve('/dist', './dist'))
app.use(serve('/public', './public'))


// historyApiFallback and ssr
router.get('*', (ctx, next) => {
    if (!renderer) {
        return ctx.body ='waiting for compilation.. refresh in a moment.'
    }
    ctx.set('Content-Type', 'text/html')
    ctx.set('Server', serverInfo)
    const s = Date.now()
    const context = { url: ctx.url }
    const renderStream = renderer.renderToStream(context)
    const res = ctx.res
    return new Promise(function (resolve) {
        renderStream.once('data', () => {
            res.statusCode = 200
            res.write(indexHTML.head)
        })
        renderStream.on('data', chunk => {
            res.write(chunk)
        })
        renderStream.on('end', () => {
            if (context.initialState) {
                res.write(
                    `<script>window.__INSTAL_STATE__=${
                        serialize(context.initialState)
                    }</script>`
                )
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
            console.error(`error during render : ${ctx.url}`)
            console.error(err)
        })
    })
})
app.use(router.routes()).use(router.allowedMethods())

const port = process.env.PORT || 8089
app.listen(port, () => {
    console.log(`server started at localhost:${port}`)
})
