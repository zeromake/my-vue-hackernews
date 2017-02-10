import 'es6-promise/auto'
import { app, store } from './app'

store.replaceState(window.__INSTAL_STATE__)

app.$mount('#app')

if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator){
	navigator.serviceWorker.register('/service-worker.js')
}