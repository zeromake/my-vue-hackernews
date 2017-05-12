import LRU from 'lru-cache'
// import Axios from 'axios'
import fetch from 'node-fetch'

export function createAPI ({ config, version }) {
    let api
    if (process.__API__) {
        api = process.__API__
    } else {
        api = {
            // url: 'https://hacker-news.firebaseio.com/v0/',
            url: `${config.url}/api/`,
            onServer: true,
            cachedItems: LRU({
                max: 1000,
                maxAge: 1000 * 60 * 15
            }),
            cachedIds: {},
            '$get': function (url) {
                return fetch(url).then(res => res.json())
            },
            '$post': function (url, data) {
                return fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    body: JSON.stringify(data)
                }).then(res => res.json())
            }
        }
        const arr = ['top', 'new']
        arr.forEach(type => {
            api.$get(`${api.url}${type}stories.json`).then(res => {
                api.cachedIds[type] = res
            })
        })
        process.__API__ = api
    }
    return api
}
