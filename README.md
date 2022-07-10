### 简单实现视频的分片上传
#### 流程
1. 选择文件 input file
2. file.value -> File类型的文件 -> new File的实例
   file -> slice -> chunk -> blob
3. chunk -> formData
4. formData -> backend
5. 接收formData -> size、name、type + file
6. chunk -> backend folder
7. chunk uploaded finished
8. merge -> writeFile -> mp4 file
9. mp4 file -> split -> m3u8 -> mp4 chunk -> ts -> hls
10. folder -> static -> http://..../xxx.m3u8
11. back to frontend -> http://..../xxx.m3u8
12. 播放器 -> http://..../xxx.m3u8 -> ts chunk -> 切片播放

#### 测试
```sh
cd client
npm run dev
cd server
npm run dev
```