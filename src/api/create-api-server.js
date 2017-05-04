import LRU from 'lru-cache'
import Axios from 'axios'

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
            cachedIds: {}
        }
        const arr = ['top', 'new']
        arr.forEach(type => {
            Axios.get(`${api.url}${type}stories.json`).then(res => {
                api.cachedIds[type] = res.data
            })
        })
        process.__API__ = api
    }
    return api
}
