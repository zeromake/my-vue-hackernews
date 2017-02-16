
module.exports = (expressDevMiddleware) => {
	return function(ctx, next) {
		return new Promise(function(resolve, reject) {
            expressDevMiddleware(ctx.req, {
                end: (content) => {
                    ctx.body = content
                    resolve()
                },
                setHeader: (name, value) => {
                    ctx.headers[name] = value
                }
            }, next)
        })
	}
}