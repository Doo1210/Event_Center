import Vue from 'vue';
import EventCenter from '../src/EventCenter.vue';
import { createMockEventCenterApi } from '../src/services/mockApi.mjs';

Vue.config.productionTip = false;
const api = createMockEventCenterApi();

new Vue({
  render: h => h(EventCenter, { props: { api, showSidebar: true } }),
}).$mount('#app');
