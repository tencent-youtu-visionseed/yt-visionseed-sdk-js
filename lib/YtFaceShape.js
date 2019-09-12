/**
 * Parse the point list into YtFaceShape
 * author: Youtu Lab, Tencent
 * @summary
 */

class Point {
  constructor (x = 0, y = 0) {
    this.x = x
    this.y = y
  }
  add (o) {
    return new Point(this.x + o.x, this.y + o.y)
  }
  sub (o) {
    return new Point(this.x - o.x, this.y - o.y)
  }
  distence (o) {
    return Math.sqrt((this.x - o.x) * (this.x - o.x) + (this.y - o.y) * (this.y - o.y))
  }
  toString () {
    return '(' + this.x + ',' + this.y + ')'
  }
  // def __add__(self, o):
  //     return Point(this.x + o.x, this.y + o.y)
  // def __sub__(self, o):
  //     return Point(this.x - o.x, this.y - o.y)
  // def __truediv__(self, o):
  //     return Point(this.x / o, this.y / o)
  // def __str__(self):
  //     return "(%s, %s)" % (this.x, this.y)
  // def length(self):
  //     return math.sqrt(this.x**2 + this.y**2)
}

class YtFaceShape {
  constructor (shape) {
    this.leftEyebrow = new Array(8)
    this.rightEyebrow = new Array(8)
    this.leftEye = new Array(8)
    this.rightEye = new Array(8)
    this.nose = new Array(13)
    this.mouth = new Array(22)
    this.faceProfile = new Array(21)
    this.pupil = new Array(2)
    var idx = 0
    var i
    for (i = 0; i < this.leftEyebrow.length; i ++) {
      this.leftEyebrow[i] = new Point(shape.xList[idx], shape.yList[idx])
      idx += 1
    }
    for (i = 0; i < this.rightEyebrow.length; i ++) {
      this.rightEyebrow[i] = new Point(shape.xList[idx], shape.yList[idx])
      idx += 1
    }
    for (i = 0; i < this.leftEye.length; i ++) {
      this.leftEye[i] = new Point(shape.xList[idx], shape.yList[idx])
      idx += 1
    }
    for (i = 0; i < this.rightEye.length; i ++) {
      this.rightEye[i] = new Point(shape.xList[idx], shape.yList[idx])
      idx += 1
    }
    for (i = 0; i < this.nose.length; i ++) {
      this.nose[i] = new Point(shape.xList[idx], shape.yList[idx])
      idx += 1
    }
    for (i = 0; i < this.mouth.length; i ++) {
      this.mouth[i] = new Point(shape.xList[idx], shape.yList[idx])
      idx += 1
    }
    for (i = 0; i < this.faceProfile.length; i ++) {
      this.faceProfile[i] = new Point(shape.xList[idx], shape.yList[idx])
      idx += 1
    }
    for (i = 0; i < this.pupil.length; i ++) {
      this.pupil[i] = new Point(shape.xList[idx], shape.yList[idx])
      idx += 1
    }
  }
}

// export default {YtFaceShape}
module.exports = YtFaceShape
