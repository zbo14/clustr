'use strict'

const cluster = require('cluster')
const http = require('http')
const message = require('./message')
const {parsePort} = require('./util')

if (!cluster.isWorker) {
  throw new Error('expected cluster to be worker')
}

process.on('message', (msg) => {
  setImmediate(() => {
    if (!message.hasValidType(msg)) {
      const log = `unexpected type: ${msg.type}`
      const reply = message.replyError(msg, log)
      process.send(reply)
    } else {
      process.emit(msg.type, msg)
    }
  })
})

process.on(message.REQUEST, (msg) => {
  setImmediate(() => {
    let reply = null
    if (!message.hasValidCode(msg)) {
      const log = `unexpected code: ${msg.code}`
      reply = message.replyError(msg, log)
    } else {
      reply = message.replyOk(msg)
    }
    process.send(reply)
  })
})

const port = parsePort(process.env)

if (port) {
  http.createServer((req, res) => {
    res.writeHead(200)
    res.end(`Greetings from process ${process.pid}`)
  }).listen(port)
}