import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from './router';

const app = createApp(App);

app.config.errorHandler = (err, instance, info) => {
  console.error("Global error:", err, info);
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.zIndex = '9999';
  el.style.top = '0';
  el.style.left = '0';
  el.style.width = '100vw';
  el.style.padding = '20px';
  el.style.background = 'rgba(255,0,0,0.9)';
  el.style.color = 'white';
  el.innerHTML = `<h3>Uncaught Error</h3><pre>${String(err)}</pre><p>Info: ${info}</p>`;
  document.body.appendChild(el);
};

app.use(router);
app.mount('#app');
