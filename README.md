### js-sdk for VisionSeed - a camera module with AI ability

[![License](https://img.shields.io/github/license/tencent-youtu-visionseed/yt-visionseed-sdk-js)](https://raw.githubusercontent.com/tencent-youtu-visionseed/yt-visionseed-sdk-js/master/LICENSE)

---

腾讯优图VisionSeed，是一个融AI算法+运算能力+摄像头为一体的硬件模组，致力于向硬件开发者提供世界领先的AI能力，通过VisionSeed可轻松使用优图人脸检测、识别、配准、姿态、属性等能力。

此SDK需配合V1.2.3及以上版本固件使用，请通过官网的VisionSeed配置工具升级固件。

# install
```shell
npm i visionseed --save
```

# example
```js
const {YtVisionSeed} = require('visionseed')

var vs = new YtVisionSeed()
vs.registerOnResult( (msg) => {
  console.log(msg)
})

const main = async function () {
  try {
    await vs.open('/dev/ttyACM0')
    console.log('Face in the lib:', await vs.listFaceId())

    // don't call close() if you want to receive registerOnResult callback
    // vs.close()
  } catch (e) {
    console.log(e)
  }
}
main()
```

# more
Homepage: https://visionseed.youtu.qq.com

技术交流QQ群: 684338220(超多大佬)
