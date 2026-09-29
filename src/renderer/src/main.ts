// Where the screens start: load the styles, then put App.vue on the page.
import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

// "#app" is the empty box in index.html - the whole app gets drawn inside it.
createApp(App).mount('#app')
