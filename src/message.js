'use strict'

const crypto = require('crypto')

// Types 
exports.REQUEST = 'request'
exports.REPLY = 'reply'

// Codes
exports.BROADCAST = 'broadcast'
exports.DIRECT = 'direct'

const txId = () => {
  return crypto.randomBytes(2).toString('base64')
}

exports.hasValidType = (msg) => {
  switch (msg.type) {
    case exports.REQUEST:
    case exports.REPLY:
      return true
    default:
      return false
  }
}

exports.hasValidCode = (msg) => {
  switch (msg.code) {
    case exports.BROADCAST:
    case exports.DIRECT:
      return true
    default:
      return false
  }
}

exports.addFromId = (worker, msg) => {
  msg.fromId = worker.id
}

const request = (code, data) => {
  return {
    'type': exports.REQUEST,
    'code': code,
    'data': data,
    'txId': txId()
  }
}

const reply = (msg) => {
  return {
    'type': exports.REPLY,
    'txId': msg.txId
  }
}

exports.replyOk = (msg) => {
  const rep = reply(msg)
  rep.ok = true 
  rep.code = msg.code
  return rep
}

exports.replyError = (msg, log) => {
  const rep = reply(msg)
  rep.ok = false 
  rep.log = log
  return rep
}

exports.broadcast = (data) => {
  return request(exports.BROADCAST, data)
}

exports.direct = (toId, data) => {
  const req = request(exports.DIRECT, data)
  req.toId = toId
  return req
}