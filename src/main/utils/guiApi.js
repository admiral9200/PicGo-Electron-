import {
  dialog,
  BrowserWindow,
  clipboard,
  Notification
} from 'electron'
import db from '../../datastore'
import Uploader from './uploader'
import pasteTemplate from './pasteTemplate'
const WEBCONTENTS = Symbol('WEBCONTENTS')
const IPCMAIN = Symbol('IPCMAIN')

class GuiApi {
  constructor (ipcMain, webcontents) {
    this[WEBCONTENTS] = webcontents
    this[IPCMAIN] = ipcMain
  }

  /**
   * for plugin showInputBox
   * @param {object} options
   * return type is string or ''
   */
  showInputBox (options) {
    if (options === undefined) {
      options = {
        title: '',
        placeholder: ''
      }
    }
    this[WEBCONTENTS].send('showInputBox', options)
    return new Promise((resolve, reject) => {
      this[IPCMAIN].once('showInputBox', (event, value) => {
        resolve(value)
      })
    })
  }

  /**
   * for plugin show file explorer
   * @param {object} options
   */
  showFileExplorer (options) {
    if (options === undefined) {
      options = {}
    }
    return new Promise((resolve, reject) => {
      dialog.showOpenDialog(BrowserWindow.fromWebContents(this[WEBCONTENTS]), options, filename => {
        resolve(filename)
      })
    })
  }

  /**
   * for plugin to upload file
   * @param {array} input
   */
  async upload (input) {
    const imgs = await new Uploader(input, this[WEBCONTENTS]).upload()
    if (imgs !== false) {
      const pasteStyle = db.read().get('settings.pasteStyle').value() || 'markdown'
      let pasteText = ''
      for (let i in imgs) {
        const url = imgs[i].url || imgs[i].imgUrl
        pasteText += pasteTemplate(pasteStyle, url) + '\r\n'
        const notification = new Notification({
          title: '上传成功',
          body: imgs[i].imgUrl,
          icon: imgs[i].imgUrl
        })
        setTimeout(() => {
          notification.show()
        }, i * 100)
        db.read().get('uploaded').insert(imgs[i]).write()
      }
      clipboard.writeText(pasteText)
      this[WEBCONTENTS].send('uploadFiles', imgs)
      this[WEBCONTENTS].send('updateGallery')
      return imgs
    }
    return []
  }
}

export default GuiApi
