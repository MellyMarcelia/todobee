// TL;DR: the starting point for the screens - loads the styles, starts Vue,
// and puts App.vue on the page.
import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
