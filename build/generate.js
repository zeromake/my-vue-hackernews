const fs = require('fs')
const co = require('co')
const pify = require('pify')
const path = require('path')
const Koa = require('koa')
const KoaRuoter = require('koa-router')
const KoaServe = require('./serve')
const { createBundleRenderer } = require('vue-server-renderer')
const LRU = require('lru-cache')
const fetch = require('node-fetch')

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
app.use(serve('/api/topstories.json', './api/topstories.json'))
app.use(serve('/api/newstories.json', './api/newstories.json'))
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
            if (!isProd) {
                console.log(`whole request-${url}: ${Date.now() - s}ms`)
            }
        })
    })
}
app.use(router.routes()).use(router.allowedMethods())

const port = process.env.PORT || 8089
const docsPath = resolve('../docs')
const listens = app.listen(port, '0.0.0.0', () => {
    console.log(`server started at localhost:${port}`)

    const generate = () => co(function * () {
        const func = render
        const urls = [
            '',
            '/top',
            '/new'
        ]
        const staticUrls = [
            '/api/topstories.json',
            '/api/newstories.json'
        ]
        for (let i = 0; i < staticUrls.length; i++) {
            const url = staticUrls[i]
            const lastIndex = url.lastIndexOf('/')
            const dirPath = url.substring(0, lastIndex)
            const typeStr = url.substring(lastIndex, lastIndex + 4)
            if (!fs.existsSync(`${docsPath}${dirPath}`)) {
                yield fileSystem.mkdir(`${docsPath}${dirPath}`)
            }
            const res = yield fetch('http://127.0.0.1:8089'+ url).then(res => res.json())
            const pageCount = ~~(res.length / 20) + (res.length % 20 ? 1 : 0)
            for(let f = 1; f <= pageCount; f++) {
                urls.push(`${typeStr}/${f}`)
            }
            if (!fs.existsSync(`${docsPath}/api/item/`)) {
                yield fileSystem.mkdir(`${docsPath}/api/item/`)
            }
            for (let j = 0; j < res.length; j++) {
                const resId = res[j]
                const itemRes = yield fetch(`http://127.0.0.1:8089/api/item/${resId}.json`).then(res => res.text())
                yield fileSystem.writeFile(`${docsPath}/api/item/${resId}.json`, itemRes)
            }
            yield fileSystem.writeFile(`${docsPath}${url}`, JSON.stringify(res))
        }
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i]
            if (!fs.existsSync(`${docsPath}${url}`)) {
                yield fileSystem.mkdir(`${docsPath}${url}`)
            }
            const html = yield func(url)
            yield fileSystem.writeFile(`${docsPath}${url}/index.html`, html)
        }

    })
    const s = Date.now()
    const closeFun = () => {
        console.log(`generate: ${Date.now() - s}ms`)
        listens.close(()=> {process.exit()})
    }
    if (isProd) {
        generate().then(closeFun)
    } else {
        readyPromise.then(generate).then(closeFun)
    }

})
