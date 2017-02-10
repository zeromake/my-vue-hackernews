import ItemList from 'components/ItemList'

export function createListView (type) {
	return {
		name: `${type}-stories-view`,
		preFetch (store) {
			return store.dispatch('FETCH_LIST_DATA', { type })
		},
		render (h) {
			return h(ItemList, { props: { type } })
		}
	}
}