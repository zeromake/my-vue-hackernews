
export default {
    activeIds (state) {
        const { activeType, itemsPerPage, lists } = state
        const page = +state.route.params.page || 1
        if (activeType) {
            const start = (page - 1) * itemsPerPage
            const end = page * itemsPerPage
            return lists[activeType].slice(start, end)
        } else {
            return []
        }
    },
    activeItems (state, getters) {
        return getters.activeIds.map(id => state.items[id]).filter(_ => _)
    }
}
