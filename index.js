const path = require('path')
const fs = require('fs')
const mainConfig = {}

const getStringValue = function (inp, isPath = true) {
  try {
    inp = JSON.parse(inp)
  } catch (er) {
    if (isPath) {
      if (path.isAbsolute(inp)) {
        return inp
      } else {
        inp = require(path.join(process.cwd(), inp))
      }
    }
  }
  return inp
}

module.exports = function (directoryPath, configPath, RUN_AS_BIN) {
  if (RUN_AS_BIN) {
    if (typeof configPath === 'string') {
      // loading up the custom config, supporting in depth config values
      const passedConfig = getStringValue(configPath)
      if (typeof passedConfig === 'object') {
        Object.keys(passedConfig).forEach((ky) => {
          Object.keys(passedConfig[ky]).forEach((kyy) => {
            Object.assign(mainConfig[ky][kyy], passedConfig[ky][kyy], mainConfig[ky][kyy])
          })
          Object.assign(mainConfig[ky], passedConfig[ky], mainConfig[ky])
        })
        Object.assign(mainConfig, passedConfig, mainConfig)
      }
    }
  }

  // loading up the various modules of system, before starting server
  const JSEXT = '.js'
  const configModules = Array.isArray(mainConfig._modules) ? mainConfig._modules : Object.keys(mainConfig)
  fs.readdirSync(directoryPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() || path.extname(dirent.name).toLowerCase() === JSEXT)
    .sort((a, b) => {
      const an = path.parse(a.name).name
      // config modules will be loaded at highest priority, then directories, then files
      if (configModules.includes(an)) {
        const bn = path.parse(b.name).name
        if (configModules.includes(bn)) {
          return configModules.indexOf(an) < configModules.indexOf(bn) ? -1 : 1
        } else {
          return -1
        }
      } else if (configModules.includes(path.parse(b.name).name)) {
        return 1
      } else {
        return a.isDirectory() ? -1 : 1
      }
    })
    .forEach((mod) => {
      const required = require(path.join(directoryPath, mod.name))
      if (typeof required.init === 'function') {
        required.init(mainConfig[mod.name.split(JSEXT).shift()])
      }
    })
}
