import LRU from 'lru-cache'
import { fetchItems } from './api'
import Axios from 'axios'

let api
if (process.__API__) {
	api = process.__API__
} else {
	api = {
		url: 'https://hacker-news.firebaseio.com/v0/',
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

export default api