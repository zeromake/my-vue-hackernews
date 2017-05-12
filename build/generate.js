const fs = require('fs')
const fse = require('fs-extra')
const co = require('co')
const pify = require('pify')
const path = require('path')
const Koa = require('koa')
const KoaRuoter = require('koa-router')
const { createBundleRenderer } = require('vue-server-renderer')
const LRU = require('lru-cache')
const fetch = require('node-fetch')
const { minify } = require('html-minifier')
const topstories = require('./api/topstories.json')
const newstories = require('./api/newstories.json')

const fileSystem = {
    readFile: pify(fs.readFile),
    mkdir: pify(fs.mkdir),
    writeFile: pify(fs.writeFile),
    unlink: pify(fs.unlink)
}
const minifyOpt = {
    collapseBooleanAttributes: true,
    collapseWhitespace: true,
    decodeEntities: true,
    minifyCSS: true,
    minifyJS: true,
    processConditionalComments: true,
    removeAttributeQuotes: false,
    removeComments: false,
    removeEmptyAttributes: true,
    removeOptionalTags: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: false,
    removeStyleLinkTypeAttributes: false,
    removeTagWhitespace: false,
    sortAttributes: true,
    sortClassName: true,
    trimCustomFragments: true,
    useShortDoctype: true
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


// 模拟api
// app.use(serve('/api/topstories.json', './api/topstories.json'))
// app.use(serve('/api/newstories.json', './api/newstories.json'))
router.get('/api/newstories.json', (ctx, next) => {
    ctx.body = newstories
})
router.get('/api/topstories.json', (ctx, next) => {
    ctx.body = topstories
})
function getItem(itemId) {
    const time = parseInt(Math.random() * (1487396700 - 1400000000 + 1) + 1400000000)
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
                yield fse.mkdirs(`${docsPath}${dirPath}`)
            }
            const res = yield fetch('http://127.0.0.1:8089'+ url).then(res => res.json())
            const pageCount = ~~(res.length / 20) + (res.length % 20 ? 1 : 0)
            /* if (!fs.existsSync(`${docsPath}/api${typeStr}/`)) {
                yield fse.mkdirs(`${docsPath}/api${typeStr}/`)
            } */
            for(let f = 1; f <= pageCount; f++) {
                urls.push(`${typeStr}/${f}`)
                /* const apiStr = yield fetch(`http://127.0.0.1:8089/api${typeStr}/${f}.json`).then(res => res.text())
                yield fileSystem.writeFile(`${docsPath}/api${typeStr}/${f}.json`, apiStr) */
            }
            if (!fs.existsSync(`${docsPath}/api/item/`)) {
                yield fse.mkdirs(`${docsPath}/api/item/`)
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
                yield fse.mkdirs(`${docsPath}${url}`)
            }
            const html = yield func(url)
            const minHtml = minify(html, minifyOpt)
            yield fileSystem.writeFile(`${docsPath}${url}/index.html`, minHtml)
        }
        yield fse.copy(resolve('../dist'), `${docsPath}/dist`)
        yield fse.move(`${docsPath}/dist/service-worker.js`, `${docsPath}/service-worker.js`)
        yield fse.copy(resolve('../public'), `${docsPath}/public`)
    })
    const s = Date.now()
    const closeFun = () => {
        console.log(`generate: ${Date.now() - s}ms`)
        listens.close(()=> {process.exit(0)})
    }
    if (isProd) {
        generate().then(closeFun)
    } else {
        readyPromise.then(generate).then(closeFun)
    }

})
