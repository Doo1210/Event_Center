<template>
  <div v-if="visible" class="ec-modal-backdrop" :class="variant ? `ec-modal-backdrop--${variant}` : ''" @mousedown.self="$emit('close')">
    <section class="ec-modal" :class="[`ec-modal--${size}`, variant ? `ec-modal--${variant}` : '']" role="dialog" aria-modal="true" :aria-label="title">
      <header class="ec-modal__header">
        <h2>{{ title }}</h2>
        <button type="button" class="ec-icon-button" aria-label="关闭" @click="$emit('close')">×</button>
      </header>
      <div class="ec-modal__body"><slot /></div>
      <footer v-if="$slots.footer" class="ec-modal__footer"><slot name="footer" /></footer>
    </section>
  </div>
</template>

<script>
export default {
  name: 'BaseModal',
  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: '' },
    size: { type: String, default: 'normal' },
    variant: { type: String, default: '' },
  },
  watch: {
    visible(value) { document.body.classList.toggle('ec-modal-open', value); },
  },
  mounted() { document.addEventListener('keydown', this.onKeydown); },
  beforeDestroy() {
    document.removeEventListener('keydown', this.onKeydown);
    document.body.classList.remove('ec-modal-open');
  },
  methods: {
    onKeydown(event) { if (this.visible && event.key === 'Escape') this.$emit('close'); },
  },
};
</script>
