const {YtVisionSeed} = require('../')

var vs = new YtVisionSeed()
vs.registerOnResult( (msg) => {
  if (msg.result && msg.result.facedetectionresult) {
    // console.log(msg)
    // console.log(msg.result.facedetectionresult.faceList)
    for (var i = 0; i < msg.result.facedetectionresult.faceList.length; i++) {
      var face = msg.result.facedetectionresult.faceList[i]
      console.log('['+msg.result.frameid+'] '+face.name+' (confidence: '+face.nameconfidence.toFixed(3)+', traceId: '+face.traceid+')')
    }
  }
})
vs.registerOnStatus( (msg) => {
  // console.log(msg)
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
