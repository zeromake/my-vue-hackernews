import { createApp } from './app'

const isDev = process.env.NODE_ENV !== 'production'

export default context => {
    return new Promise((resolve, reject) => {
        const s = isDev && Date.now()
        const { app, router, store } = createApp(context)
        router.push(context.url)
        router.onReady(() => {
            const matchedComponents = router.getMatchedComponents()
            if (!matchedComponents.length) {
                return reject({ code: 404 })
            }
            Promise.all(matchedComponents.map(component => {
                return component.asyncData && component.asyncData({
                    store,
                    route: router.currentRoute
                })
            })).then(() => {
                isDev && console.log(`data pre-fetch: ${Date.now() - s}ms`)
                context.state = store.state
                resolve(app)
            }).catch(reject)
        }, reject)
    })
}
