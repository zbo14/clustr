'use strict'

const {expect} = require('chai')
const {describe, it} = require('mocha')
const http = require('http')
const message = require('../src/message')
const numCPUs = require('os').cpus().length
const supervisor = require('../src/supervisor')

const noop = () => {}

const env = {
  'LISTEN_TIMEOUT': 2000,
  'PORT': 8889
}

const settings = {
  'exec': './src/worker.js'
}

const cluster = supervisor(env, settings)
const data = 'the owls are not what they seem'

const workers = () => {
  const ws = []
  for (const id in cluster.workers) {
    ws.push(cluster.workers[id])
  }
  return ws
}

const testHttpRequest = (done) => {
  let rawData = ''
  http.get(`http://localhost:${env.PORT}`, (res) => {
    expect(res.statusCode).to.equal(200)
    res.on('data', (chunk) => {
      rawData += chunk
    })
    res.on('end', () => {
      expect(rawData).to.include('Greetings from process')
      console.log(rawData)
      done()
    })
  })
}

describe('clustr', () => {
  it('checks that all workers are running', (done) => {
    for (let i = 0; i < numCPUs - 1; i++) {
      cluster.once('online', noop)
    }
    cluster.once('online', () => {
      done()
    })
  })

  it('kills the first worker', (done) => {
    const [worker] = workers()
    const {id} = worker
    cluster.once('exit', (w) => {
      expect(w.id).to.equal(id)
      done()
    })
    worker.kill()
  })

  it(`checks that ${numCPUs} workers are active`, () => {
    const keys = Object.keys(cluster.workers)
    expect(keys).to.have.lengthOf(numCPUs)
  })

  it('broadcasts message', (done) => {
    const msg = message.broadcast(data)
    const [worker] = workers()
    for (let i = 0; i < numCPUs - 1; i++) {
      cluster.once(message.REPLY, (_, m) => {
          expect(m.type).to.equal(message.REPLY)
          expect(m.code).to.equal(message.BROADCAST)
          expect(m.txId).to.equal(msg.txId)
      })
    }
    cluster.once(message.REPLY, (_, m) => {
      expect(m.type).to.equal(message.REPLY)
      expect(m.code).to.equal(message.BROADCAST)
      expect(m.txId).to.equal(msg.txId)
      done()
    })
    cluster.emit('message', worker, msg)
  })

  it('sends direct message', (done) => {
    const [
      fromWorker, 
      toWorker
    ] = workers()
    const toId = toWorker.id
    const msg = message.direct(toId, data)
    cluster.once(msg.txId, (w, m) => {
      expect(w.id).to.equal(toId)
      expect(m.type).to.equal(message.REPLY)
      expect(m.code).to.equal(message.DIRECT)
      expect(m.txId).to.equal(msg.txId)
      done()
    })
    cluster.emit('message', fromWorker, msg)
  })

  it('tries to send message with unexpected type', (done) => {
    const [worker] = workers()
    cluster.once('error', (err) => {
      expect(err).to.be.an('error')
      expect(err.message).to.include('unexpected type')
      done()
    })
    cluster.emit('message', worker, {'type': 'badtype'})
  })

  it('tries to send message with unexpected code', (done) => {
    const [worker] = workers()
    cluster.once('error', (err) => {
      expect(err).to.be.an('error')
      expect(err.message).to.include('unexpected code')
      done()
    })
    cluster.emit('message', worker, {
      'type': message.REQUEST, 
      'code': 'badcode'
    })
  })

  it('tries to send message to unexpected worker id', (done) => {
    const [worker] = workers()
    const msg = message.direct(100, 'cabin fervor')
    cluster.once('error', (err) => {
      expect(err).to.be.an('error')
      expect(err.message).to.include('unexpected worker id')
      done()
    })
    cluster.emit('message', worker, msg)
  })

  it('sends message with invalid type to worker', (done) => {
    const [worker] = workers()
    cluster.once('myId', (w, m) => {
      expect(w.id).to.equal(worker.id)
      expect(m.type).to.deep.equal(message.REPLY)
      expect(m.ok).to.be.false
      expect(m.log).to.include('unexpected type')
      done()
    })
    worker.send({
      'type': 'badtype', 
      'txId': 'myId'
    })
  })

  it('sends message with invalid code to worker', (done) => {
    const [worker] = workers()
    cluster.once('myId', (w, m) => {
      expect(w.id).to.equal(worker.id)
      expect(m.type).to.deep.equal(message.REPLY)
      expect(m.ok).to.be.false
      expect(m.log).to.include('unexpected code')
      done()
    })
    worker.send({
      'type': message.REQUEST, 
      'code': 'badcode', 
      'txId': 'myId'
    })
  })

  it('makes request to http server', (done) => {
    testHttpRequest(done)
  })

  it('makes another request to http server', (done) => {
    testHttpRequest(done)
  })
})