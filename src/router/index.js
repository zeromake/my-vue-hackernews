import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

import { createListView } from '../views/CreateListView'

export default new Router({
	mode: 'history',
	scrollBehavior: () => ({ y: 0 }),
	routes: [
		{ path: '/top/:page(\\d+)?', component: createListView('top') },
    	{ path: '/new/:page(\\d+)?', component: createListView('new') },
		{ path: '/', redirect: '/top' }
	]
})