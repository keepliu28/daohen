import type { UserConfigExport } from "@tarojs/cli"

export default {
   logger: {
    quiet: false,
    stats: true
  },
  mini: {},
  h5: {},
  cloudEnv: 'n1-daohen-9ga3v5k246792d59', // 云开发环境ID
} satisfies UserConfigExport<'webpack5'>
