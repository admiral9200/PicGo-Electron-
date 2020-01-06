import bus from './eventBus'
import PicGoCore from '~/universal/types/picgo'
import path from 'path'
import {
  app,
  globalShortcut,
  BrowserWindow
} from 'electron'
import logger from './logger'
import GuiApi from './guiApi'
import db from '#/datastore'
import shortKeyService from './shortKeyService'
import picgo from './picgo'

class ShortKeyHandler {
  private isInModifiedMode: boolean = false
  constructor () {
    bus.on('toggleShortKeyModifiedMode', flag => {
      this.isInModifiedMode = flag
    })
  }
  init () {
    this.initBuiltInShortKey()
    this.initPluginsShortKey()
  }
  private initBuiltInShortKey () {
    const commands = db.get('settings.shortKey') as IShortKeyConfigs
    Object.keys(commands)
      .filter(item => item.includes('picgo:'))
      .map(command => {
        const config = commands[command]
        globalShortcut.register(config.key, () => {
          this.handler(command)
        })
      })
  }
  private initPluginsShortKey () {
    const pluginList = picgo.pluginLoader.getList()
    for (let item of pluginList) {
      const plugin = picgo.pluginLoader.getPlugin(item)
      // if a plugin has commands
      if (plugin && plugin.commands) {
        if (typeof plugin.commands !== 'function') {
          logger.warn(`${item}'s commands is not a function`)
          continue
        }
        const commands = plugin.commands(picgo) as IPluginShortKeyConfig[]
        for (let cmd of commands) {
          const command = `${item}:${cmd.name}`
          if (db.has(`settings.shortKey[${command}]`)) {
            const commandConfig = db.get(`settings.shortKey.${command}`) as IShortKeyConfig
            this.registerShortKey(commandConfig, command, cmd.handle, false)
          } else {
            this.registerShortKey(cmd, command, cmd.handle, true)
          }
        }
      } else {
        continue
      }
    }
  }
  private registerShortKey (config: IShortKeyConfig | IPluginShortKeyConfig, command: string, handler: IShortKeyHandler, writeFlag: boolean) {
    shortKeyService.registerCommand(command, handler)
    if (config.key) {
      globalShortcut.register(config.key, () => {
        this.handler(command)
      })
    } else {
      logger.warn(`${command} do not provide a key to bind`)
    }
    if (writeFlag) {
      picgo.saveConfig({
        [`settings.shortKey.${command}`]: {
          enable: true,
          name: config.name,
          label: config.label,
          key: config.key
        }
      })
    }
  }
  // enable or disable shortKey
  bindOrUnbindShortKey (item: IShortKeyConfig, from: string): boolean {
    const command = `${from}:${item.name}`
    if (item.enable === false) {
      globalShortcut.unregister(item.key)
      picgo.saveConfig({
        [`settings.shortKey.${command}.enable`]: false
      })
      return true
    } else {
      if (globalShortcut.isRegistered(item.key)) {
        return false
      } else {
        picgo.saveConfig({
          [`settings.shortKey.${command}.enable`]: true
        })
        globalShortcut.register(item.key, () => {
          this.handler(command)
        })
        return true
      }
    }
  }
  // update shortKey bindings
  updateShortKey (item: IShortKeyConfig, oldKey: string, from: string): boolean {
    const command = `${from}:${item.name}`
    if (globalShortcut.isRegistered(item.key)) return false
    globalShortcut.unregister(oldKey)
    picgo.saveConfig({
      [`settings.shortKey.${command}.key`]: item.key
    })
    globalShortcut.register(item.key, () => {
      this.handler(`${from}:${item.name}`)
    })
    return true
  }
  private async handler (command: string) {
    if (this.isInModifiedMode) {
      return
    }
    if (command.includes('picgo:')) {
      bus.emit(command)
    } else if (command.includes('picgo-plugin-')) {
      const handler = shortKeyService.getShortKeyHandler(command)
      if (handler) {
        const guiApi = new GuiApi()
        return handler(picgo, guiApi)
      }
    } else {
      logger.warn(`can not find command: ${command}`)
    }
  }
  registerPluginShortKey (pluginName: string) {
    const plugin = picgo.pluginLoader.getPlugin(pluginName)
    if (plugin && plugin.commands) {
      if (typeof plugin.commands !== 'function') {
        logger.warn(`${pluginName}'s commands is not a function`)
        return
      }
      const commands = plugin.commands(picgo) as IPluginShortKeyConfig[]
      for (let cmd of commands) {
        const command = `${pluginName}:${cmd.name}`
        if (db.has(`settings.shortKey[${command}]`)) {
          const commandConfig = db.get(`settings.shortKey[${command}]`) as IShortKeyConfig
          this.registerShortKey(commandConfig, command, cmd.handle, false)
        } else {
          this.registerShortKey(cmd, command, cmd.handle, true)
        }
      }
    }
  }
  unregisterPluginShortKey (pluginName: string) {
    const commands = db.get('settings.shortKey') as IShortKeyConfigs
    const keyList = Object.keys(commands)
      .filter(command => command.includes(pluginName))
      .map(command => {
        return {
          command,
          key: commands[command].key
        }
      }) as IKeyCommandType[]
    keyList.forEach(item => {
      globalShortcut.unregister(item.key)
      shortKeyService.unregisterCommand(item.command)
      picgo.unsetConfig('settings.shortKey', item.command)
    })
  }
}

export default new ShortKeyHandler()
