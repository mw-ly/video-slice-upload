const express = require('express')
const uploader = require('express-fileupload')
const CryptoJS = require('crypto-js')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffmpeg = require('fluent-ffmpeg')

const { resolve } = require('path')
const {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  unlinkSync,
  rmdirSync,
  readdirSync,
  mkdirSync
} = require('fs')
const e = require('express')

const app = express()
const PORT = 8000

// 解析 URL-encoded 格式的请求体数据
app.use(express.urlencoded({ extended: true }))
// 解析json格式的数据
app.use(express.json())
// 处理上传文件
app.use(uploader())
// 静态文件跨域
app.use('/', express.static('videos', {
  setHeaders (res) {
    res.set('Access-Control-Allow-Origin', '*')
  }
}))

// 设置文件路径
ffmpeg.setFfmpegPath(ffmpegPath)

// http://localhost:8080/xxx/xxx.m3u8

const ALLOWED_TYPES = {
  'video/mp4': 'mp4',
  'video/wmv': 'wmv',
  'hls': 'm3u8'
}

const tempDir = resolve(__dirname, './temp/'),
      videoDir = resolve(__dirname, './videos/')

// 请求跨域
app.all('*', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'POST,GET')
  next()
})

app.post('/upload_video', (req, res) => {
  // chunk -> folder -> temp
  const { name, type, size, chunkName } = req.body

  const { chunk } = req.files,
        fileName = CryptoJS.MD5(name),
        tempFilesDir = tempDir + '/' + fileName
  
  if (!chunk) {
    res.send({
      code: 1001,
      msg: 'No file uploaded'
    })
    return
  }

  if (!ALLOWED_TYPES[type]) {
    res.send({
      code: 1002,
      msg: 'The type is not allowed for uploading'
    })
    return
  }

  // 如果不存在gai文件夹，则创建
  if (!existsSync(tempFilesDir)) {
    mkdirSync(tempFilesDir)
  }

  writeFileSync(tempFilesDir + '/' + chunkName, chunk.data)

  res.send({
    code: 200,
    msg: 'Chunk is uploaded',
    fileName: fileName.toString()
  })
})

app.post('/merge_video', (req, res) => {
  // chun -> mp4
  const { fileName, type } = req.body,
        tempFilesDir = tempDir + '/' + fileName,
        videoFileDir = videoDir + '/' + fileName
        fileList = readdirSync(tempFilesDir)

  if (!existsSync(videoFileDir)) {
    mkdirSync(videoFileDir)
  }

  const mp4Path = `${ videoFileDir }/${ fileName }.${ ALLOWED_TYPES[type] }`,
        hlsPath = `${ videoFileDir }/${ fileName }.${ ALLOWED_TYPES['hls'] }`

  fileList.forEach(chunkName => {
    const chunkPath = `${ tempFilesDir }/${ chunkName }`,
          chunkContent = readFileSync(chunkPath)

    if (!existsSync(mp4Path)) {
      writeFileSync(mp4Path, chunkContent)
    } else {
      appendFileSync(mp4Path, chunkContent)
    }

    // 删除已被合并的chunk文件
    unlinkSync(chunkPath)
  })

  // 合并之后，删除文件夹
  rmdirSync(tempFilesDir)

  formatVideo(mp4Path, {
    videoCodec: 'libx264',
    format: 'hls',
    outputOptions: '-hls_list_size 0',
    outputOption: '-hls_time 5',
    output: hlsPath,
    onError (e) {
      const fileList = readdirSync(videoFileDir)
      
      fileList.forEach(chunkName => {
        const chunkPath = `${ videoFileDir }/${ chunkName }`
        unlinkSync(chunkPath)
      })

      rmdirSync(videoFileDir)

      res.send({
        code: 1006,
        msg: e.message
      })
    },
    onEnd () {
      res.send({
        code: 200,
        msg: 'Upload successfully',
        videoSrc: `http://localhost:8000/${ fileName }/${ fileName }.${ ALLOWED_TYPES['hls'] }`
      })
    }
  })
})

function formatVideo (path, {
  videoCodec,
  format,
  outputOptions,
  outputOption,
  output,
  onError,
  onEnd
}) {
  ffmpeg(path)
    .videoCodec(videoCodec)
    .format(format)
    .outputOptions(outputOptions)
    .outputOption(outputOption)
    .output(output)
    .on('error', onError)
    .on('end', onEnd)
    .run()
}

app.listen(PORT, () => {
  console.log('Server is running on: ' + PORT)
})