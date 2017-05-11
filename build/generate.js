const fs = require('fs')
const co = require('co')
const pify = require('pify')
const path = require('path')
const Koa = require('koa')
const KoaRuoter = require('koa-router')
const KoaServe = require('./serve')
const { createBundleRenderer } = require('vue-server-renderer')
const LRU = require('lru-cache')

const fileSystem = {
    readFile: pify(fs.readFile),
    mkdir: pify(fs.mkdir),
    writeFile: pify(fs.writeFile)
}
const resolve = file => path.resolve(__dirname, file)

const isProd = process.env.NODE_ENV === 'production'

const app = new Koa()
const router = new KoaRuoter()

const template = fs.readFileSync(resolve('../src/index.template.html'), 'utf-8')

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
    const bundle = require('../dist/vue-ssr-server-bundle.json')
    const clientManifest = require('../dist/vue-ssr-client-manifest.json')
    renderer = createRenderer(bundle, {
        clientManifest
    })
} else {
    readyPromise = require('./setup-dev-server')(app, (bundle, options) => {
        renderer = createRenderer(bundle, options)
    })
}

const serve = (url, path, cache) => KoaServe(url, {
    root: resolve(path),
    maxAge: cache && isProd ? 60 * 60 * 24 * 30 : 0
})

// 模拟api
app.use(serve('/api/topstories.json', '../public/api/topstories.json'))
app.use(serve('/api/newstories.json', '../public/api/newstories.json'))
router.get('/api/item/:id.json', (ctx, next) => {
    const id = ctx.params.id
    const time = ~~(Math.random() * (1487396700 - 1400000000 + 1) + 1400000000)
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

function render (url) {
    return new Promise (function (resolve, reject) {
        const s = Date.now()
        const handleError = err => {
            reject()
        }
        const context = {
            title: 'Vue Ssr 2.3',
            url: url
        }
        renderer.renderToString(context, (err, html) => {
            if (err) {
                return handleError(err)
            }
            resolve(html)
            if (isProd) {
                console.log(`whole request-${url}: ${Date.now() - s}ms`)
            }
        })
    })
}
app.use(router.routes()).use(router.allowedMethods())

const port = process.env.PORT || 8089
const listens = app.listen(port, '0.0.0.0', () => {
    console.log(`server started at localhost:${port}`)
    const generate = () => co(function * () {
        const func = render
        const urls = [
            '/top',
            '',
            '/new',
            '/top/1',
            '/top/2',
            '/new/1',
            '/new/2'
        ]
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i]
            if (!fs.existsSync(resolve(`../dist${url}`))) {
                yield fileSystem.mkdir(resolve(`../dist${url}`))
            }
            const html = yield func(url)
            yield fileSystem.writeFile(resolve(`../dist${url}/index.html`), html)
        }
    })
    const s = Date.now()
    if (isProd) {
        generate().then(() => {
            console.log(`generate: ${Date.now() - s}ms`)
            listens.close(()=> {process.exit()})
        })
    } else {
        readyPromise.then(generate).then(() => {
            console.log(`generate: ${Date.now() - s}ms`)
            listens.close(()=> {process.exit()})
        })
    }

})
