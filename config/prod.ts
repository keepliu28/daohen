import type { UserConfigExport } from "@tarojs/cli"

export default {
  mini: {},
  h5: {
    compile: {
      include: [
        // 确保产物为 es5
        filename => /node_modules\/(?!(@babel|core-js|style-loader|css-loader|react|react-dom))/.test(filename)
      ]
    },
    cloudEnv: 'n1-daohen-9ga3v5k246792d59' // 云开发环境ID
  }
} satisfies UserConfigExport<'webpack5'>
