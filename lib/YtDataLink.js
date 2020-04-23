/**
 * Parse the YtDataLink protocol
 * author: chenliang @ Youtu Lab, Tencent
 * @extends Transform
 * @summary A transform stream that emits YtDataLink packets as they are received.
 * @example
    const {YtDataLink, proto} = require('visionseed')

    var datalink = new YtDataLink()
    datalink.msgHandler = function (msg) {
      console.log(msg)
    }

    const main = async function () {
      try {
        await datalink.open('/dev/ttyACM0')
      } catch (e) {
        console.log(e)
      }
    }
    main()
 */

const fs = require('await-fs')
const proto = require('./YtMsg_pb')
const Transform = require('stream').Transform
const SerialPort = require('serialport')
const YtFaceShape = require('./YtFaceShape')
if (global.TextDecoder === undefined) {
  const util = require('util')
  global.TextDecoder = util.TextDecoder
}

var YtVisionSeedResultType = {
  YT_RESULT_RECT: 0,
  YT_RESULT_ARRAY: 1,
  YT_RESULT_CLASSIFICATION: 2,
  YT_RESULT_STRING: 3,
  YT_RESULT_POINTS: 4,
  YT_RESULT_VARUINT32: 5
}
class YtVisionSeedResultTypeConfidence {
  constructor () {
    this.type = 'YtVisionSeedResultTypeConfidence'
    this.conf = 0
  }
  parse (bufObj) {
    let conf = YtDataLink.unpackUInt16(bufObj)
    this.conf = conf / 65535
  }
}
class YtVisionSeedResultTypeClassification extends YtVisionSeedResultTypeConfidence {
  constructor () {
    super()
    this.type = 'YtVisionSeedResultTypeClassification'
    this.cls = 0
  }
  parse (bufObj) {
    super.parse(bufObj)
    this.cls = YtDataLink.unpackUInt16(bufObj)
  }
}
class YtVisionSeedResultTypeRect extends YtVisionSeedResultTypeClassification {
  constructor () {
    super()
    this.type = 'YtVisionSeedResultTypeRect'
    this.x = 0
    this.y = 0
    this.w = 0
    this.h = 0
  }
  parse (bufObj) {
    super.parse(bufObj)
    this.x = YtDataLink.unpackInt16(bufObj)
    this.y = YtDataLink.unpackInt16(bufObj)
    this.w = YtDataLink.unpackInt16(bufObj)
    this.h = YtDataLink.unpackInt16(bufObj)
  }
}
class YtVisionSeedResultTypeArray {
  constructor () {
    this.type = 'YtVisionSeedResultTypeArray'
    this.array = []
  }
  parse (bufObj, count) {
    let cur_data = bufObj.p.subarray(bufObj.i, bufObj.i + count)
    var ab = new ArrayBuffer(count)
    var ba = new Uint8Array(ab)
    var fa = new Float32Array(ab)

    ba.set(cur_data)
    // for (var i=0; i<count/4; i ++) {
    //   ba[i*4 + 0] = cur_data[i*4 + 0]
    //   ba[i*4 + 1] = cur_data[i*4 + 1]
    //   ba[i*4 + 2] = cur_data[i*4 + 2]
    //   ba[i*4 + 3] = cur_data[i*4 + 3]
    // }

    for (var i = 0; i < count / 4; i ++) {
      this.array.push(fa[i])
    }
    bufObj.i += count
  }
}
class YtVisionSeedResultTypeString extends YtVisionSeedResultTypeConfidence {
  constructor () {
    super()
    this.type = 'YtVisionSeedResultTypeString'
    this.str = ''
  }
  parse (bufObj, count) {
    if (count < 3) { //at least 1 for the null terminator and 2 for confidence
      return
    }
    super.parse(bufObj)
    let cur_data = bufObj.p.subarray(bufObj.i, bufObj.i + count - 1 - 2)
    bufObj.i += count - 2 // - 1 null terminator
    this.str = new TextDecoder('utf-8').decode(cur_data)
  }
}
class YtVisionSeedResultTypePoints {
  constructor () {
    this.type = 'YtVisionSeedResultTypePoints'
    this.points = []
  }
  parse (bufObj, count) {
    for (var i = 0; i < count / 4; i ++) {
      this.points.push({
        x: YtDataLink.unpackInt16(bufObj),
        y: YtDataLink.unpackInt16(bufObj),
      })
    }
  }
}
class DataV2 {
  constructor (buf) {
    this.YtVisionSeedModel = {
      FACE_DETECTION: 1,
      FACE_LANDMARK: 2,
      FACE_POSE: 3,
      FACE_QUALITY: 4,
      FACE_RECOGNITION: 6,
      DETECTION_TRACE: 8
    }

    this.data = {}
    let bufObj = {p: buf, i: 0}
    let count = bufObj.p[bufObj.i ++]
    for (let i = 0; i < count; i++) {
      let cur_path_len = bufObj.p[bufObj.i ++]
      let cur_path = bufObj.p.subarray(bufObj.i, bufObj.i + cur_path_len)
      bufObj.i += cur_path_len
      let type = bufObj.p[bufObj.i ++]
      let cur_data_len = YtDataLink.unpackVarUInt32(bufObj)

      let result = null
      if (type === YtVisionSeedResultType.YT_RESULT_CLASSIFICATION && cur_data_len === 4) {
        result = new YtVisionSeedResultTypeClassification()
      } else if (type === YtVisionSeedResultType.YT_RESULT_RECT && cur_data_len === 12) {
        result = new YtVisionSeedResultTypeRect()
      } else if (type === YtVisionSeedResultType.YT_RESULT_ARRAY) {
        result = new YtVisionSeedResultTypeArray()
      } else if (type === YtVisionSeedResultType.YT_RESULT_STRING) {
        result = new YtVisionSeedResultTypeString()
      } else if (type === YtVisionSeedResultType.YT_RESULT_POINTS) {
        result = new YtVisionSeedResultTypePoints()
      } else if (type === YtVisionSeedResultType.YT_RESULT_VARUINT32) {
        result = YtDataLink.unpackVarUInt32(bufObj)
      }

      if (result !== null) {
        if (result.parse !== undefined) {
          result.parse(bufObj, cur_data_len)
        }
        if (type === YtVisionSeedResultType.YT_RESULT_POINTS && result.points.length === 90) {
          result.faceShape = new YtFaceShape(result)
        }
        this.data[cur_path] = result
      } else {
        let cur_data = bufObj.p.subarray(bufObj.i, bufObj.i + cur_data_len)
        this.data[cur_path] = cur_data
        bufObj.i += cur_data_len
      }
    }
    // console.log('[result]', this.data)
  }
  getResult (path) {
    return this.data[path.join(',')]
  }
}

var YtDataLinkStatus = {
  YT_DL_IDLE: 0,
  YT_DL_LEN1_PENDING: 1,
  YT_DL_LEN2_PENDING: 2,
  YT_DL_LEN3_PENDING: 3,
  YT_DL_LEN_CRC_H: 4,
  YT_DL_LEN_CRC_L: 5,
  YT_DL_DATA: 6,
  YT_DL_CRC_H: 7,
  YT_DL_CRC_L: 8
}
const SOF = 0x10
const TRANS = 0x11
const ytMsgSize = 2097152
const fileBlobSize = 131072
const ccittTable = [
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50A5, 0x60C6, 0x70E7,
  0x8108, 0x9129, 0xA14A, 0xB16B, 0xC18C, 0xD1AD, 0xE1CE, 0xF1EF,
  0x1231, 0x0210, 0x3273, 0x2252, 0x52B5, 0x4294, 0x72F7, 0x62D6,
  0x9339, 0x8318, 0xB37B, 0xA35A, 0xD3BD, 0xC39C, 0xF3FF, 0xE3DE,
  0x2462, 0x3443, 0x0420, 0x1401, 0x64E6, 0x74C7, 0x44A4, 0x5485,
  0xA56A, 0xB54B, 0x8528, 0x9509, 0xE5EE, 0xF5CF, 0xC5AC, 0xD58D,
  0x3653, 0x2672, 0x1611, 0x0630, 0x76D7, 0x66F6, 0x5695, 0x46B4,
  0xB75B, 0xA77A, 0x9719, 0x8738, 0xF7DF, 0xE7FE, 0xD79D, 0xC7BC,
  0x48C4, 0x58E5, 0x6886, 0x78A7, 0x0840, 0x1861, 0x2802, 0x3823,
  0xC9CC, 0xD9ED, 0xE98E, 0xF9AF, 0x8948, 0x9969, 0xA90A, 0xB92B,
  0x5AF5, 0x4AD4, 0x7AB7, 0x6A96, 0x1A71, 0x0A50, 0x3A33, 0x2A12,
  0xDBFD, 0xCBDC, 0xFBBF, 0xEB9E, 0x9B79, 0x8B58, 0xBB3B, 0xAB1A,
  0x6CA6, 0x7C87, 0x4CE4, 0x5CC5, 0x2C22, 0x3C03, 0x0C60, 0x1C41,
  0xEDAE, 0xFD8F, 0xCDEC, 0xDDCD, 0xAD2A, 0xBD0B, 0x8D68, 0x9D49,
  0x7E97, 0x6EB6, 0x5ED5, 0x4EF4, 0x3E13, 0x2E32, 0x1E51, 0x0E70,
  0xFF9F, 0xEFBE, 0xDFDD, 0xCFFC, 0xBF1B, 0xAF3A, 0x9F59, 0x8F78,
  0x9188, 0x81A9, 0xB1CA, 0xA1EB, 0xD10C, 0xC12D, 0xF14E, 0xE16F,
  0x1080, 0x00A1, 0x30C2, 0x20E3, 0x5004, 0x4025, 0x7046, 0x6067,
  0x83B9, 0x9398, 0xA3FB, 0xB3DA, 0xC33D, 0xD31C, 0xE37F, 0xF35E,
  0x02B1, 0x1290, 0x22F3, 0x32D2, 0x4235, 0x5214, 0x6277, 0x7256,
  0xB5EA, 0xA5CB, 0x95A8, 0x8589, 0xF56E, 0xE54F, 0xD52C, 0xC50D,
  0x34E2, 0x24C3, 0x14A0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405,
  0xA7DB, 0xB7FA, 0x8799, 0x97B8, 0xE75F, 0xF77E, 0xC71D, 0xD73C,
  0x26D3, 0x36F2, 0x0691, 0x16B0, 0x6657, 0x7676, 0x4615, 0x5634,
  0xD94C, 0xC96D, 0xF90E, 0xE92F, 0x99C8, 0x89E9, 0xB98A, 0xA9AB,
  0x5844, 0x4865, 0x7806, 0x6827, 0x18C0, 0x08E1, 0x3882, 0x28A3,
  0xCB7D, 0xDB5C, 0xEB3F, 0xFB1E, 0x8BF9, 0x9BD8, 0xABBB, 0xBB9A,
  0x4A75, 0x5A54, 0x6A37, 0x7A16, 0x0AF1, 0x1AD0, 0x2AB3, 0x3A92,
  0xFD2E, 0xED0F, 0xDD6C, 0xCD4D, 0xBDAA, 0xAD8B, 0x9DE8, 0x8DC9,
  0x7C26, 0x6C07, 0x5C64, 0x4C45, 0x3CA2, 0x2C83, 0x1CE0, 0x0CC1,
  0xEF1F, 0xFF3E, 0xCF5D, 0xDF7C, 0xAF9B, 0xBFBA, 0x8FD9, 0x9FF8,
  0x6E17, 0x7E36, 0x4E55, 0x5E74, 0x2E93, 0x3EB2, 0x0ED1, 0x1EF0
]

class YtMsgParser extends Transform {
  constructor (cb) {
    super()
    this.cb = cb
  }
  _transform (buffer, _, _cb) {
    this.cb(buffer)
    _cb()
  }
}
class YtDataLink {
  constructor () {
    this.array = []
    this.cursor = 0
    this.mStatus = YtDataLinkStatus.YT_DL_IDLE
    this.mMsgLen = 0
    this.mCrc = 0
    this.mCrcCalc = 0xffff
    this.mTrans = false
    this.mCrcSendCalc = 0xffff
    this.port = null
    this.errorHandler = null
    this.msgHandler = null
    this.statusHandler = null
    //======================
    this.rpcId = 0
    this.rpcCalls = {}
  }
  crcUpdate (ch, first) {
    if (first) {
      this.mCrcCalc = 0xffff
    }
    this.mCrcCalc = ccittTable[(this.mCrcCalc >> 8 ^ ch) & 0xff] ^ ((this.mCrcCalc << 8) & 0xffff)
  }
  toHex (d) {
    return ('0' + (Number(d).toString(16))).slice(-2).toUpperCase()
  }
  recvRunOnce (buffer) {
    this.cursor += buffer.length
    Array.from(buffer).map(byte => this.array.push(byte))
    // console.log('[YtMsgParser] recv ' + buffer.length)
    while (this.cursor > 0) {
      var ch = this.array.splice(0, 1)[0]
      this.cursor --
      if (ch === SOF) {
        if (this.mStatus !== YtDataLinkStatus.YT_DL_IDLE) {
          console.log('[YtMsg] unfinished pkg(%d/%d)', this.mBufi, this.mMsgLen)
        }
        this.mStatus = YtDataLinkStatus.YT_DL_LEN1_PENDING
      } else if (ch === TRANS) {
        this.mTrans = true
      } else {
        //转义后，不会出现SOF, TRANS
        if (this.mTrans) {
          ch = ch ^ TRANS
          this.mTrans = false
        }
        switch (this.mStatus) {
          case YtDataLinkStatus.YT_DL_IDLE:
            break
          case YtDataLinkStatus.YT_DL_LEN1_PENDING:
            // console.log('[YtMsg] begin\n')
            this.mStatus = YtDataLinkStatus.YT_DL_LEN1_PENDING
            this.mMsgLen = 0
            this.mCrc = 0
            //falls through
          case YtDataLinkStatus.YT_DL_LEN2_PENDING:
          case YtDataLinkStatus.YT_DL_LEN3_PENDING:
            // console.log('[YtMsg]', this.toHex(ch))
            this.crcUpdate(ch, this.mStatus === YtDataLinkStatus.YT_DL_LEN1_PENDING)
            this.mMsgLen = (this.mMsgLen << 8) | ch
            if (this.mStatus === YtDataLinkStatus.YT_DL_LEN3_PENDING) {
              if (this.mMsgLen > ytMsgSize) {
                console.log('[YtMsg] Error: msg len %d > %d\n', this.mMsgLen, ytMsgSize)
                this.mStatus = YtDataLinkStatus.YT_DL_IDLE
                continue
              }
            }
            this.mStatus = this.mStatus + 1
            break
          case YtDataLinkStatus.YT_DL_LEN_CRC_H:
            this.mCrc = (this.mCrc << 8) | ch
            this.mStatus = this.mStatus + 1
            break
          case YtDataLinkStatus.YT_DL_LEN_CRC_L:
            this.mCrc = (this.mCrc << 8) | ch
            if ((this.mCrcCalc) !== this.mCrc) {
              console.log('[YtMsg] Error: msg len crc 0x%04x !== 0x%04x\n', (this.mCrcCalc), this.mCrc)
              this.mStatus = YtDataLinkStatus.YT_DL_IDLE
              continue
            }
            this.mStatus = this.mStatus + 1
            this.mBuf = new Array(this.mMsgLen)
            this.mBufi = 0
            // if (this.mMsgLen > 1024) {
            //   console.log('[YtMsg] pkg too large?', this.mMsgLen)
            // }
            break
          case YtDataLinkStatus.YT_DL_DATA:
            this.crcUpdate(ch, this.mBufi === 0)
            this.mBuf[this.mBufi ++] = ch
            if (this.mBufi === this.mMsgLen) {
              this.mStatus = this.mStatus + 1
            }
            break
          case YtDataLinkStatus.YT_DL_CRC_H:
            this.mCrc = 0
            //falls through
          case YtDataLinkStatus.YT_DL_CRC_L:
            this.mCrc = (this.mCrc << 8) | ch
            if (this.mStatus === YtDataLinkStatus.YT_DL_CRC_L) {
              if ((this.mCrcCalc) !== this.mCrc) {
                console.log('[YtMsg] Error: msg crc 0x%04x !== 0x%04x\n', (this.mCrcCalc), this.mCrc)
                this.mStatus = YtDataLinkStatus.YT_DL_IDLE
                continue
              }

              const frame = Buffer.from(this.mBuf)
              // console.log('[frame]', frame)
              // this.push(frame)
              var msg = null
              try {
                msg = proto.YtMsg.deserializeBinary(frame).toObject(true)
              } catch (e) {
                console.log(e)
              }
              if (msg) {
                if (this.msgHandler) {
                  try {
                    this.msgHandler(msg)
                  } catch (e) {
                    console.log(e)
                  }
                }

                if (msg.response) {
                  // 找到之前的rpc请求callback
                  if (msg.response.sequenceid !== undefined) {
                    var cb = this.rpcCalls[msg.response.sequenceid]
                    // console.log('resp', msg.response.sequenceid, cb)
                    if (cb) {
                      var err = null
                      if (msg.response.code !== proto.YtRpcResponse.ReturnCode.SUCC &&
                          msg.response.code !== proto.YtRpcResponse.ReturnCode.CONTINUE) {
                        err = this.getErrMsg(msg.response.code)
                      }
                      cb(err, msg)
                    }
                    delete this.rpcCalls[msg.response.sequenceid]
                  }
                }
              }

              this.mStatus = YtDataLinkStatus.YT_DL_IDLE
              continue
            }
            this.mStatus = this.mStatus + 1
            break

          default:
            console.log('[YtMsg] Error: unknown status %d\n', this.mStatus)
            break
        }
      }
    }
  }
  //============================================================================
  genRpcId () {
    // console.log('rpc', this.rpcId)
    return this.rpcId ++
  }
  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  async open (path) {
    try {
      await this._open(path)
      this.port.pipe(new YtMsgParser((buf) => {
        this.recvRunOnce(buf)
      }))
      if (this.statusHandler) {
        try {
          this.statusHandler(true)
        } catch (e) {
          console.log(e)
        }
      }
      //等待读取清空VS上的发送队列，避免后续RPC请求回复失败
      await this.sleep(50)
      console.log('opened')
    } catch (e) {
      this.port = null
      if (this.errorHandler) {
        try {
          this.errorHandler(e)
        } catch (e) {
          console.log('from open', e)
        }
      }
      throw (e)
    }
  }
  _open (path) {
    return new Promise((resolve, reject) => {
      this.port = new SerialPort(path, {baudRate: 115200}, function (err) {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
      this.port.on('close', (err) => {
        if (err) {
          console.log('[serial] close on error: ', err)
          this.close()
        }
      })
    })
  }
  async close () {
    try {
      await this._close()
      if (this.statusHandler) {
        try {
          this.statusHandler(false)
        } catch (e) {
          console.log(e)
        }
      }
      console.log('closed')
    } catch (e) {
      if (this.errorHandler) {
        try {
          this.errorHandler(e)
        } catch (e) {
          console.log('from close', e)
        }
      }
    }
  }
  _close () {
    return new Promise((resolve, reject) => {
      if (this.port) {
        this.port.close(function (err) {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
        this.port = null
      } else {
        resolve()
      }
    })
  }
  _sendRpcMsg (rpc, cb) {
    var rpcid = this.genRpcId()
    this.rpcCalls[rpcid] = cb
    rpc.setSequenceid(rpcid)
    var message = new proto.YtMsg()
    message.setRpc(rpc)
    var bytes = message.serializeBinary()
    this.write(bytes, cb)
  }
  async sendRpcMsg (rpc) {
    return new Promise((resolve, reject) => {
      this._sendRpcMsg(rpc, (e, msg) => {
        if (e) {
          if (this.errorHandler) {
            try {
              this.errorHandler(e)
            } catch (e) {
              console.log('from response', e)
            }
          }
          reject(e)
        } else {
          resolve(msg)
        }
      })
    })
  }
  async _sendFilePackage (remoteFile, totalLength, buf, offset, auth = '') {
    var rpc = new proto.YtRpc()
    rpc.setFunc(proto.YtRpc.Function.UPLOADFILE)
    rpc.setAuth(auth)

    var params = new proto.FilePart()
    params.setPath(remoteFile)
    params.setTotallength(totalLength)
    params.setOffset(offset)
    params.setData(buf)
    rpc.setFilepart(params)
    var result = await this.sendRpcMsg(rpc)
    if (result.response) {
    } else {
      throw (new Error('未知错误'))
    }
  }
  async sendFile (localFile, remoteFile, auth = '', progressCb) {
    let data = await fs.readFile(localFile)
    // console.log(data.length)

    var totalLength = data.length
    var currentOffset = 0
    var remaining = totalLength
    var sizeToTransmit = 0
    while (remaining > 0) {
      sizeToTransmit = remaining > fileBlobSize ? fileBlobSize : remaining
      var buf = data.slice(currentOffset, currentOffset + sizeToTransmit)
      await this._sendFilePackage(remoteFile, totalLength, buf, currentOffset, auth)
      currentOffset += sizeToTransmit
      remaining = totalLength - currentOffset
      if (progressCb) {
        progressCb(parseInt(Math.min(remaining === 0 ? 100 : 99, (currentOffset + sizeToTransmit) / totalLength * 100)))
      }
    }
  }
  getErrMsg (code) {
    let errMsgs = {}
    let c = proto.YtRpcResponse.ReturnCode
    errMsgs[c.ERROR_REGISTER_FACEID_TIMEOUT] = '在指定时间内，没有检测到合格人脸'
    errMsgs[c.ERROR_FILE_EXCEED_LIMITS] = '文件超过大小/尺寸限制'
    errMsgs[c.ERROR_REGISTER_FACEID_NO_FACE_DETECTED] = '没有检测到人脸'
    errMsgs[c.ERROR_REGISTER_FACEID_TOO_MANY_FACES] = '人脸太多'
    errMsgs[c.ERROR_REGISTER_FACEID_FILE_NOT_READABLE] = '无效文件'
    errMsgs[c.ERROR_REGISTER_FACEID_LIB_FULL] = '库满了'
    errMsgs[c.ERROR_FACEID_NOT_EXIST] = 'FaceID不存在'

    if (errMsgs[code]) {
      return errMsgs[code]
    } else {
      return '未知错误'
    }
  }
  crcSendUpdate (ch, first) {
    if (first) {
      this.mCrcSendCalc = 0xffff
    }
    this.mCrcSendCalc = ccittTable[(this.mCrcSendCalc >> 8 ^ ch) & 0xff] ^ ((this.mCrcSendCalc << 8) & 0xffff)
  }
  write (bytes, cbError) {
    try {
      if (this.port) {
        var bytesBuffer = Buffer.from(bytes)

        // console.log(bytes)
        var buffer = Buffer.alloc(bytes.length + 8)
        buffer[0] = 0x10
        this.crcSendUpdate(buffer[1] = [(bytes.length >> 16) & 0xff], true)
        this.crcSendUpdate(buffer[2] = [(bytes.length >> 8) & 0xff])
        this.crcSendUpdate(buffer[3] = [(bytes.length >> 0) & 0xff])
        buffer[4] = (this.mCrcSendCalc >> 8) & 0xff
        buffer[5] = (this.mCrcSendCalc >> 0) & 0xff
        bytesBuffer.copy(buffer, 6)
        var transLen = 0
        var i
        for (i = 1; i < buffer.length; i++) {
          if (i >= 6 && i < buffer.length - 2) {
            this.crcSendUpdate(buffer[i], i === 6)
          }
          if (buffer[i] === 0x10 || buffer[i] === 0x11) {
            transLen++
          }
        }
        buffer[buffer.length - 2] = (this.mCrcSendCalc >> 8) & 0xff
        buffer[buffer.length - 1] = (this.mCrcSendCalc >> 0) & 0xff
        for (i = buffer.length - 2; i < buffer.length; i++) {
          if (buffer[i] === 0x10 || buffer[i] === 0x11) {
            transLen++
          }
        }
        var idx = 0
        var transedBuffer = Buffer.alloc(buffer.length + transLen)
        for (i = 0; i < buffer.length; i++) {
          if ((buffer[i] === 0x10 || buffer[i] === 0x11) && i > 0) {
            transedBuffer[idx++] = 0x11
            transedBuffer[idx++] = buffer[i] ^ 0x11
          } else {
            transedBuffer[idx++] = buffer[i]
          }
        }
        // var begin = 0
        // var bulk = 10240
        // while (begin < transedBuffer.length) {
        //   await this._write(transedBuffer.slice(begin, begin + bulk))
        //   begin += bulk
        //   await new Promise((resolve, reject) => {
        //     setTimeout(() => {
        //       resolve()
        //     }, 10)
        //   })
        // }

        this.port.write(transedBuffer, function (err) {
          if (err) {
            cbError(err)
          }
        })

        // for (i = 0; i < 1024; i++) {
        //   var bbb = Buffer.alloc(1024, i % 256)
        //   await this._write(bbb)
        // }
        // console.log(buffer)
      } else {
        throw new Error('端口未打开')
      }
    } catch (e) {
      if (this.errorHandler) {
        try {
          this.errorHandler(e)
        } catch (e) {
          console.log('from write', e)
        }
      }
      cbError(e.toString())
    }
  }
  // 结果包解析
  // static const uint8_t* getResultOfModel(const uint8_t *buf, uint8_t &ret_len, const uint8_t path[], const uint8_t path_len);
  // static bool getResultOfModel(const uint8_t *buf, YtVisionSeedResultTypeRect *rect, const uint8_t path[], const uint8_t path_len);
  // static bool getResultOfModel(const uint8_t *buf, YtVisionSeedResultTypeClassification *cls, const uint8_t path[], const uint8_t path_len);
  // static uint8_t getResultsCountOfModel(const uint8_t *buf, const uint8_t path[], const uint8_t path_len);
  // static uint8_t addResultRaw(pb_bytes_array_t *data, const uint8_t path[], const uint8_t path_len, const uint8_t *content, const uint8_t len);
  // static uint8_t addResult(pb_bytes_array_t *data, const uint8_t path[], const uint8_t path_len, const YtVisionSeedResultTypeRect &rect);
  // static uint8_t addResult(pb_bytes_array_t *data, const uint8_t path[], const uint8_t path_len, const YtVisionSeedResultTypeClassification &cls);
  // static uint8_t initDataV2(YtMsg *message);
  static unpackInt16 (bufObj) {
    let ret = 0
    ret = bufObj.p[bufObj.i + 1]
    ret <<= 8
    ret |= bufObj.p[bufObj.i]
    bufObj.i += 2
    return ret
  }
  static unpackUInt16 (bufObj) {
    let ret = 0
    ret = bufObj.p[bufObj.i + 1]
    ret <<= 8
    ret |= bufObj.p[bufObj.i]
    bufObj.i += 2
    return ret
  }
  static unpackVarUInt32 (bufObj) {
    let ret = 0
    let shift = 0
    while (true) {
      let byte = bufObj.p[bufObj.i ++]
      ret |= (byte & 0x7f) << shift
      if ((byte & 0x80) === 0) {
        break
      }
      shift += 7
    }
    return ret
  }
  static getResultsCountOfModel (buf, path) {
    let ret = 0
    let bufObj = {p: buf, i: 0}
    let count = bufObj.p[bufObj.i ++]
    for (let i = 0; i < count; i++) {
      let cur_path_len = bufObj.p[bufObj.i ++]
      let cur_path = bufObj.p.subarray(bufObj.i, bufObj.i + cur_path_len)
      bufObj.i += cur_path_len
      let cur_data_type = bufObj.p[bufObj.i ++]
      let cur_data_len = YtDataLink.unpackVarUInt32(bufObj)
      if (cur_path_len === path.length) {
        if (('' + cur_path) === ('' + path)) {
          ret ++
        }
      }
      bufObj.i += cur_data_len
    }
    return ret
  }
  static getResultOfModel (buf, path) {
    let bufObj = {p: buf, i: 0}
    let count = bufObj.p[bufObj.i ++]
    for (let i = 0; i < count; i++) {
      let cur_path_len = bufObj.p[bufObj.i ++]
      let cur_path = bufObj.p.subarray(bufObj.i, bufObj.i + cur_path_len)
      bufObj.i += cur_path_len
      let cur_data_type = bufObj.p[bufObj.i ++]
      let cur_data_len = YtDataLink.unpackVarUInt32(bufObj)
      if (cur_path_len === path.length) {
        if (('' + cur_path) === ('' + path)) {
          return bufObj.p.subarray(bufObj.i, bufObj.i + cur_data_len)
        }
      }
      bufObj.i += cur_data_len
    }
    return null
  }

  static parseDataV2 (buf) {
    return new DataV2(buf)
  }
}

// export default {YtDataLink}
module.exports = YtDataLink
