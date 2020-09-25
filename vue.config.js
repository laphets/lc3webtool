const MonacoEditorPlugin = require('monaco-editor-webpack-plugin')

module.exports = {
  publicPath: '/wenqing4/lc3web-dist/',
  configureWebpack: {
      plugins: [
          new MonacoEditorPlugin({
              languages: [],
              features: []
          })
      ]
  },
  transpileDependencies: [
    "vuetify"
  ]
}