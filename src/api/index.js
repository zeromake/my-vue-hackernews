import { createAPI } from 'create-api'
// import Axios from 'axios'

const logRequests = !!process.env.DEBUG_API

const api = createAPI({
    version: '/v0',
    config: {
        url: 'http://127.0.0.1:8089'
    }
})

if (api.onServer) {
    warmCache()
}

function warmCache () {
    fetchItems((api.cachedIds.top || []).slice(0, 30))
    setTimeout(warmCache, 1000 * 60 * 15)
}

function fetch (child) {
    logRequests && console.log(`fetching ${child}...`)
    const cache = api.cachedItems
    if (cache && cache.has(child)) {
        logRequests && console.log(`cache hit for ${child}.`)
        return Promise.resolve(cache.get(child))
    } else {
        return new Promise((resolve, reject) => {
            api.$get(api.url + child + '.json').then(res => {
                const val = res
                if (val) val.__lastUpdate = Date.now()
                cache && cache.set(child, val)
                logRequests && console.log(`fetched ${child}.`)
                resolve(val)
            }).catch(reject)
        })
    }
}

export function fetchIdsByType (type) {
    return api.cachedIds && api.cachedIds[type]
        ? Promise.resolve(api.cachedIds[type])
        : fetch(`${type}stories`)
}
export function fetchItem (id) {
    return fetch(`item/${id}`)
}

export function fetchItems (ids) {
    return Promise.all(ids.map(id => fetchItem(id)))
}
export function fetchPage (type, page) {
    return fetch(`${type}/${page}`)
}
export function fetchUser (id) {
    return fetch(`user/${id}`)
}

/**
* 监听数据变动(未使用firebase先使用定时刷新)
*/
export function watchList (type, cb) {
    let first = true
    let isOn = true
    let timeoutId = null
    const handler = res => {
        cb(res)
    }
    function watchTimeout () {
        if (first) {
            first = false
        } else {
            api.$get(`${api.url}${type}stories.json`).then(handler)
        }
        if (isOn) {
            timeoutId = setTimeout(watchTimeout, 1000 * 60 * 15)
        }
    }
    watchTimeout()
    return () => {
        isOn = false
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
    }
}
