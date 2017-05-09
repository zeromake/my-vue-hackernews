import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

const createListView = id => () => import('../views/CreateListView').then(m => m.default(id))
// import { createListView } from '../views/CreateListView'

export function createRouter () {
    return new Router({
        mode: 'history',
        scrollBehavior: () => ({ y: 0 }),
        routes: [
            { path: '/top/:page(\\d+)?', component: createListView('top') },
            { path: '/new/:page(\\d+)?', component: createListView('new') },
            { path: '/', redirect: '/top' }
        ]
    })
}
