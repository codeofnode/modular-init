const path = require('path')
const fs = require('fs')

class Modular {
  /**
   * a sleep while loop
   */
  static waitFor (cond, fn, err = 'waiting_timed_out', interval = 1000, count = 60) {
    if (count < 0) fn(new Error(err))
    else if (cond()) fn()
    else setTimeout(Modular.waitFor.bind(undefined, cond, fn, err, interval, --count), interval)
  }

  /**
   * get the value after parsing or reading from file
   */
  static getStringValue (inp, isPath = true) {
    try {
      inp = JSON.parse(inp)
    } catch (er) {
      if (isPath) {
        if (path.isAbsolute(inp)) {
          try {
            inp = require(inp)
          } catch (er) {
            inp = {}
          }
        } else {
          try {
            inp = require(path.join(process.cwd(), inp))
          } catch (er) {
            inp = {}
          }
        }
      }
    }
    return inp
  }

  /**
   * initialize the modules
   */
  static initialize (directoryPath, mainConfig = {}, configPath = {}, RUN_AS_BIN = false) {
    if (RUN_AS_BIN) {
      let passedConfig
      if (typeof configPath === 'string') {
        passedConfig = Modular.getStringValue(configPath)
      } else if (typeof configPath === 'object') {
        passedConfig = configPath || {}
      }
      // loading up the custom config, supporting in depth config values
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

    // loading up the various modules of system, before starting server
    const JSEXT = '.js'
    const configModules = Array.isArray(mainConfig._modules) ? mainConfig._modules : Object.keys(mainConfig)
    const finalModules = []
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
        finalModules.push(required)
        if (typeof required.init === 'function') {
          required.init(mainConfig[mod.name.split(JSEXT).shift()])
        }
      })
    return new Promise((resolve, reject) => {
      Modular.waitFor(() => {
        const ln = finalModules.length
        for (let k = 0; k < ln; k++) {
          const mod = finalModules[k]
          if (typeof mod.isReady === 'function') {
            if (mod.isReady() !== true) {
              return false
            }
          }
        }
        return true
      }, (er) => {
        if (er) reject(er)
        else resolve()
      }, 'Modules are not ready.')
    })
  }
}

module.exports = Modular
