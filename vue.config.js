const MonacoEditorPlugin = require('monaco-editor-webpack-plugin')

module.exports = {
  outputDir: 'docs',
  publicPath: '/wenqing4/lc3-web/',
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