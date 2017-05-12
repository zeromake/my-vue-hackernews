const fs = require('fs')
const path = require('path')
const Koa = require('koa')
const KoaRuoter = require('koa-router')
const KoaServe = require('./build/serve')
const serialize = require('serialize-javascript')
const { createBundleRenderer } = require('vue-server-renderer')
const LRU = require('lru-cache')
const topstories = require('./build/api/topstories.json')
const newstories = require('./build/api/newstories.json')

const resolve = file => path.resolve(__dirname, file)

const isProd = process.env.NODE_ENV === 'production'
const useMicroCache = process.env.MICRO_CACHE !== 'false'

const serverInfo = `koa/${require('koa/package.json').version}|` +
    `vue-server-renderer/${require('vue-server-renderer/package.json').version}`

const app = new Koa()
const router = new KoaRuoter()

const template = fs.readFileSync(resolve('./src/index.template.html'), 'utf-8')

function createRenderer (bundle, options) {
    return createBundleRenderer(
        bundle,
        Object.assign(options, {
            template,
            cache: LRU({
                max: 1000,
                maxAge: 1000 * 60 * 15
            }),
            basedir: resolve('./dist'),
            runInNewContext: false
        })
    )
}

let renderer
let readyPromise
if (isProd) {
    const bundle = require('./dist/vue-ssr-server-bundle.json')
    const clientManifest = require('./dist/vue-ssr-client-manifest.json')
    renderer = createRenderer(bundle, {
        clientManifest
    })
} else {
    readyPromise = require('./build/setup-dev-server')(app, (bundle, options) => {
        renderer = createRenderer(bundle, options)
    })
}

const serve = (url, path, cache) => KoaServe(url, {
    root: resolve(path),
    maxAge: cache && isProd ? 60 * 60 * 24 * 30 : 0
})

// 模拟api
router.get('/api/newstories.json', (ctx, next) => {
    ctx.body = newstories
})
router.get('/api/topstories.json', (ctx, next) => {
    ctx.body = topstories
})
function getItem(itemId) {
    const time = ~~(Math.random() * (1487396700 - 1400000000 + 1) + 1400000000)
    return {
        by: 'zero' + itemId,
        descendants: 0,
        id: itemId,
        score: itemId - 13664000,
        time: time,
        title: `测试Item:${itemId} - ${time}`,
        type: 'story',
        url: `/api/item/${itemId}.json`

    }
}
router.get('/api/item/:id.json', (ctx, next) => {
    const itemId = ctx.params.id
    ctx.body = getItem(itemId)
})
typeObj = {
    'new': newstories,
    'top': topstories
}
router.get('/api/:type/:page.json', (ctx, next) => {
    const type = ctx.params.type
    const page = +ctx.params.page || 1
    const typestories = typeObj[type]
    if (typestories) {
        const ids = typestories.slice((page - 1) * 20, page * 20)
        ctx.body = ids.map(i => getItem(i))
    } else {
        ctx.body = []
    }
})

// 加载和设置static
// app.use(compression({ threshold: 0}))
// app.use(favicon('./public/logo-48.png'))
app.use(serve('/dist', './dist', true))
app.use(serve('/public', './public', true))
// app.use(serve('/manifest.json','./manifest.json', true))
// app.use(serve('/service-worker.js', './dist/servivce-worker.js'))

// 1-second microcache.
const microCache = LRU({
    max: 100,
    maxAge: 10000
})
// 根据请求信息判断是否微缓存
const isCacheable = ctx => useMicroCache
function render (ctx, next) {
    ctx.set("Content-Type", "text/html")
    ctx.set("Server", serverInfo)
    return new Promise (function (resolve, reject) {
        const s = Date.now()
        const handleError = err => {
            if (err && err.code === 404) {
                ctx.status = 404
                ctx.body = '404 | Page Not Found'
            } else {
                ctx.status = 500
                ctx.body = '500 | Internal Server Error'
                console.error(`error during render : ${ctx.url}`)
                console.error(err.stack)
            }
            resolve()
        }
        const cacheable = isCacheable(ctx)
        if (cacheable) {
            const hit = microCache.get(ctx.url)
            if (hit) {
                if (!isProd) {
                    console.log('cache hit!')
                }
                ctx.body = hit
                resolve()
                return
            }
        }
        const context = {
            title: 'Vue Ssr 2.3',
            url: ctx.url
        }
        renderer.renderToString(context, (err, html) => {
            if (err) {
                return handleError(err)
            }
            ctx.body = html
            resolve()
            if (cacheable) {
                microCache.set(ctx.url, html)
            }
            if (!isProd) {
                console.log(`whole request: ${Date.now() - s}ms`)
            }
        })
    })
}
// historyApiFallback and ssr
router.get('*', isProd ? render: (ctx, next) => {
    return readyPromise.then(() => render(ctx, next))
})
app.use(router.routes()).use(router.allowedMethods())

const port = process.env.PORT || 8089
app.listen(port, '0.0.0.0', () => {
    console.log(`server started at localhost:${port}`)
})
