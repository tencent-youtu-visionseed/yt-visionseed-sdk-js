const {YtVisionSeed} = require('../')

let vs = new YtVisionSeed()
vs.registerOnResult( (msg) => {
  let YtVisionSeedModel = msg.result.datav2.YtVisionSeedModel
  let count = msg.result.datav2.getResult([YtVisionSeedModel.FACE_DETECTION])
  for (let i = 0; i < count; i++) {
    let line = ''
    let rect = msg.result.datav2.getResult([YtVisionSeedModel.FACE_DETECTION, i])
    if (rect) {
      line += 'rect: (' + rect.x + ', ' + rect.y + ', ' + rect.w + ', ' + rect.h + ') '
    }
    let faceName = msg.result.datav2.getResult([YtVisionSeedModel.FACE_DETECTION, i, YtVisionSeedModel.FACE_RECOGNITION])
    if (faceName) {
      line += 'name: '+faceName.str+' (confidence: '+faceName.conf.toFixed(3)+') '
    }
    let traceId = msg.result.datav2.getResult([YtVisionSeedModel.FACE_DETECTION, i, YtVisionSeedModel.DETECTION_TRACE])
    if (traceId !== undefined) {
      line += 'traceId: '+traceId+' '
    }
    let shape = msg.result.datav2.getResult([YtVisionSeedModel.FACE_DETECTION, i, YtVisionSeedModel.FACE_LANDMARK])
    if (shape)
    {
      let faceShape = shape.faceShape
      let l1 = faceShape.mouth[0].distence(faceShape.mouth[6])
      let l2 = faceShape.mouth[3].distence(faceShape.mouth[9])
      let ratio = (l2 / (l1 + 0.01))
      line += 'mouth: ' + (ratio > 1 ? 'open' : 'close')
    }
    console.log(line)
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
