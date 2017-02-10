import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

import { createListView } from '../views/CreateListView'
import ItemView from '../views/ItemView'

export default new Router({
	mode: 'history',
	scrollBehavior: () => ({ y: 0 }),
	routes: [
		{ path: '/top/:page(\\d+)?', component: createListView('top')},
		{ path: '/item/:id(\\d+)', component: ItemView },
		{ path: '/', redirect: '/top' }
	]
})