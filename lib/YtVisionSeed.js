/**
 * SDK interface of the VisionSeed
 * author: chenliang @ Youtu Lab, Tencent
 * @example
    const {YtVisionSeed} = require('visionseed')

    var vs = new YtVisionSeed()
    vs.registerOnResult( (msg) => {
      console.log(msg)
    })
    vs.registerOnStatus( (msg) => {
      console.log(msg)
    })

    const main = async function () {
      try {
        await vs.open('/dev/ttyACM0')
      } catch (e) {
        console.log(e)
      }
    }
    main()
 */

const proto = require('./YtMsg_pb')
const YtDataLink = require('./YtDataLink')

class YtVisionSeed {
  constructor () {
    this.datalink = new YtDataLink()
    this.datalink.msgHandler = (msg) => {
      if (msg.result) {
        if (msg.result.facedetectionresult) {
          if (this.onResult) {
            this.onResult(msg)
          }
        } else if (msg.result.systemstatusresult) {
          if (this.onStatus) {
            this.onStatus(msg)
          }
        }
      }
    }
  }
  registerOnResult (handler) {
    this.onResult = handler
  }
  registerOnStatus (handler) {
    this.onStatus = handler
  }
  async open (port) {
    await this.datalink.open(port)
  }
  async close () {
    await this.datalink.close()
  }
  isOpened () {
    return !!this.datalink.port
  }

  // Camera
  async SetCamAutoExposure (camId) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.SETEXPOSURE)
    var cameraExposureParams = new proto.CameraExposureParams()
    cameraExposureParams.setType(1)
    cameraExposureParams.setCamid(camId)
    rpc.setCameraexposureparams(cameraExposureParams)
    await this.datalink.sendRpcMsg(rpc)
  }
  async setCamManualExposure (camId, timeUs, gain) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.SETEXPOSURE)
    var cameraExposureParams = new proto.CameraExposureParams()
    cameraExposureParams.setType(0)
    cameraExposureParams.setTimeus(timeUs)
    cameraExposureParams.setGain(gain)
    cameraExposureParams.setCamid(camId)
    rpc.setCameraexposureparams(cameraExposureParams)
    await this.datalink.sendRpcMsg(rpc)
  }
  async setFlasher (flasherIR) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.SETFLASHER)
    var flashParams = new proto.FlasherParams()
    flashParams.setIr(flasherIR)
    rpc.setFlasherparams(flashParams)
    await this.datalink.sendRpcMsg(rpc)
  }
  async setMainCamId (value) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.SETMAINCAMERA)
    rpc.setIntparams(value)
    await this.datalink.sendRpcMsg(rpc)
  }
  async setRotation (value) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.SETCAMERAROTATION)
    rpc.setIntparams(value)
    await this.datalink.sendRpcMsg(rpc)
  }
  async setDebugDrawing (value) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.SETDEBUGDRAWING)
    rpc.setIntparams(value)
    await this.datalink.sendRpcMsg(rpc)
  }

  // Files
  async listFile (path) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.LISTFILE)
    rpc.setStrparams(path)
    var result = await this.datalink.sendRpcMsg(rpc)
    if (result.response) {
      return result.response.filelistresult.filesList
    }
    return null
  }
  async deleteFile (path, auth) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.DELETEFILE)
    rpc.setStrparams(path)
    rpc.setAuth(auth)
    await this.datalink.sendRpcMsg(rpc)
  }

  // Info
  async getDeviceInfo () {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.GETDEVICEINFO)
    var result = await this.datalink.sendRpcMsg(rpc)
    if (result.response) {
      return result.response.strdata.split(' ')
    }
  }

  // Face retrieve
  async getFacePic (faceId) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.GETFACEPIC)
    rpc.setIntparams(faceId)
    var resp = await this.datalink.sendRpcMsg(rpc)
    return resp.response.filepart.data
  }
  async clearFaceLib () {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.CLEARFACELIB)
    await this.datalink.sendRpcMsg(rpc)
  }
  async setFaceId (faceId, faceName) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.SETFACEID)
    var params = new proto.SetFaceIdParams()
    params.setFaceid(faceId)
    params.setFacename(faceName)
    rpc.setSetfaceidparams(params)
    await this.datalink.sendRpcMsg(rpc)
  }
  async registerFaceIdFromCamera (faceName, timeoutMs) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.REGISTERFACEIDFROMCAMERA)
    var params = new proto.RegisterFaceIdFromCameraParams()
    params.setTimeoutms(timeoutMs)
    params.setFacename(faceName)
    rpc.setRegisterfaceidfromcameraparams(params)
    var result = await this.datalink.sendRpcMsg(rpc)
    if (result.response && result.response.intdata !== undefined) {
      return result.response.intdata
    } else {
      throw (new Error('未知错误'))
    }
  }
  async registerFaceIdWithRemotePic (remoteFile, faceName) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.REGISTERFACEIDWITHPIC)
    var params = new proto.RegisterFaceIdWithPicParams()
    params.setFilepath(remoteFile)
    params.setFacename(faceName)
    rpc.setRegisterfaceidwithpicparams(params)
    var result = await this.datalink.sendRpcMsg(rpc)
    if (result.response && result.response.intdata !== undefined) {
      return result.response.intdata
    } else {
      throw (new Error('未知错误'))
    }
  }
  async registerFaceIdWithPic (localFile, faceName, progressCb) {
    let remoteFile = '/tmp/reg.jpg'
    await this.datalink.sendFile(localFile, remoteFile, progressCb)
    let faceId = await this.registerFaceIdWithRemotePic(remoteFile, faceName)
    return faceId
  }
  async deleteFaceId (faceId) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.DELETEFACEID)
    rpc.setIntparams(faceId)
    await this.datalink.sendRpcMsg(rpc)
  }
  async deleteFaceName (faceName) {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.DELETEFACENAME)
    rpc.setStrparams(faceName)
    let resp = await this.datalink.sendRpcMsg(rpc)
    return resp.response.intdata
  }
  async listFaceId () {
    var ret = []
    var start = 0
    while (true) {
      var rpc = new proto.YtRpc()
      rpc.setFunc(proto.YtRpc.Function.LISTFACEID)
      var params = new proto.ListFaceIdParams()
      params.setStart(start)
      params.setLength(100)
      rpc.setListfaceidparams(params)
      let result = await this.datalink.sendRpcMsg(rpc)
      let data = result.response.faceidlistdata.facesList
      if (data.length === 0) {
        break
      }
      ret = ret.concat(data)
      start = data[ data.length - 1 ].faceid + 1
    }
    return ret
  }
}

// export default {YtVisionSeed}
module.exports = YtVisionSeed
