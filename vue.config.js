const MonacoEditorPlugin = require('monaco-editor-webpack-plugin')

module.exports = {
  outputDir: 'docs',
  publicPath: '/lc3webtool/',
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