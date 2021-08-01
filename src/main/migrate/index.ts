import { DBStore } from '@picgo/store'
import ConfigStore from '~/main/apis/core/datastore'
import path from 'path'
import fse from 'fs-extra'
// from v2.1.2
const updateShortKeyFromVersion212 = (db: typeof ConfigStore, shortKeyConfig: IShortKeyConfigs | IOldShortKeyConfigs) => {
  // #557 极端情况可能会出现配置不存在，需要重新写入
  if (shortKeyConfig === undefined) {
    const defaultShortKeyConfig = {
      enable: true,
      key: 'CommandOrControl+Shift+P',
      name: 'upload',
      label: '快捷上传'
    }
    db.set('settings.shortKey[picgo:upload]', defaultShortKeyConfig)
    return true
  }
  if (shortKeyConfig.upload) {
    // @ts-ignore
    shortKeyConfig['picgo:upload'] = {
      enable: true,
      key: shortKeyConfig.upload,
      name: 'upload',
      label: '快捷上传'
    }
    // @ts-ignore
    delete shortKeyConfig.upload
    db.set('settings.shortKey', shortKeyConfig)
    return true
  }
  return false
}

const migrateGalleryFromVersion230 = async (configDB: typeof ConfigStore, galleryDB: DBStore) => {
  const originGallery: ImgInfo[] = configDB.get('uploaded')
  const configPath = configDB.getConfigPath()
  const configBakPath = path.join(path.dirname(configPath), 'config-bak.json')
  if (fse.existsSync(configBakPath)) {
    return
  }
  // migrate gallery from config to gallery db
  if (originGallery && originGallery?.length > 0) {
    fse.copyFileSync(configPath, configBakPath)
    await galleryDB.insertMany(originGallery)
    configDB.set('uploaded', [])
  }
}

export {
  updateShortKeyFromVersion212,
  migrateGalleryFromVersion230
}
