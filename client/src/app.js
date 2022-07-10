import axios from 'axios'
import qs from 'qs'
import 'xgplayer'
import HlsPlayer from 'xgplayer-hls'

import {
  API,
  ALLOWED_TYPES,
  UPLOAD_INFO,
  CHUNK_SIZE
} from './config'

;((doc) => {
  const oProgress = doc.querySelector('#uploadProgress'),
        oUploader = doc.querySelector('#videoUploader'),
        oInfo = doc.querySelector('#uploadInfo'),
        oStartBtn = doc.querySelector('#startBtn'),
        oPauseBtn = doc.querySelector('#pauseBtn')

  let paused = true,
      uploadedSize = 0,
      uploadResult = null,
      uploadedFileName = ''
        
  const init = () => {
    bindEvent()
  }

  function bindEvent() {
    oStartBtn.addEventListener('click', uploadVideo, false)
    oPauseBtn.addEventListener('click', switchUploader.bind(null, true), false)
  }

  // 上传视频
  async function uploadVideo () {
    switchUploader(false)
    const { files: [ file ] } = oUploader
    console.log('file', file)

    // 未选择文件
    if (!file) {
      oInfo.innerText = UPLOAD_INFO['NO_FILE']
      return
    }
    // 不支持该文件格式
    if (!ALLOWED_TYPES[file.type]) {
      oInfo.innerText = UPLOAD_INFO['INVALID_TYPE']
      return
    }

    const { name, size, type } = file

    oProgress.max = size
    // 断点续传
    uploadedSize = Number(localStorage.getItem(name) || 0)
    oInfo.innerText = UPLOAD_INFO['UPLOADING']

    while (uploadedSize < size && !paused) {
      // 切片
      console.log(name)
      console.log(`.${ ALLOWED_TYPES[type] }`)
      const chunk = file.slice(uploadedSize, uploadedSize + CHUNK_SIZE),
            chunkName = Date.now() + '_' + name.replace(`.${ ALLOWED_TYPES[type] }`, ''),
            formData = createFormData({
              name,
              type,
              size,
              chunk,
              chunkName
            })

      try {
        // 上传chunk
        uploadResult = await axios.post(API.UPLOAD_VIDEO, formData)
        console.log(uploadResult)
      } catch (e) {
        oInfo.innerText = `${ UPLOAD_INFO['FAILED'] }(${ e.message })`
        return
      }
      // chunk上传成功
      if (uploadResult.data.code === 200) {
        // 更新当前上传的位置
        uploadedSize += chunk.size
        // 更新进度条
        oProgress.value = uploadedSize
        // 保存已上传位置，用于断点续传
        localStorage.setItem(name, uploadedSize)
      }
    }

    mergeVideo(name, type)
  }

  async function mergeVideo (name, type) {
    if (!paused) {
      uploadedFileName = uploadResult.data.fileName
      oInfo.innerText = UPLOAD_INFO['TRANSCODING']

      const res = await axios.post(API.MERGE_VIDEO, qs.stringify({
        fileName: uploadedFileName,
        type
      }))

      localStorage.removeItem(name)

      if (res.data.code === 1006) {
        oInfo.innerText = `${ UPLOAD_INFO['FAILED'] }(${ res.data.msg })`
        return
      } else if (res.data.code === 200) {
        oInfo.innerText = UPLOAD_INFO['SUCCESS']
        oUploader.value = null
        switchUploader(true)

        new HlsPlayer({
          id: 'videoContainer',
          url: res.data.videoSrc
        })
      }
    }
  }

  function createFormData ({
    name,
    type,
    size,
    chunk,
    chunkName
  }) {
    const fd = new FormData()

    fd.append('name', name)
    fd.append('type', type)
    fd.append('size', size)
    fd.append('chunk', chunk)
    fd.append('chunkName', chunkName)

    return fd
  }

  function switchUploader (bool) {
    paused = bool
    oStartBtn.style.display = paused ? 'block' : 'none'
    oPauseBtn.style.display = paused ? 'none' : 'block'
  }



  init()

})(document)