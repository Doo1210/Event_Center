module.exports = {
  publicPath: process.env.NODE_ENV === 'production' ? '/Event_Center/' : '/',
  pages: {
    index: {
      entry: 'demo/main.js',
      template: 'public/index.html',
      filename: 'index.html',
    },
  },
  productionSourceMap: false,
};
