'use strict'

const cluster = require('cluster')
const message = require('./message')
const numCPUs = require('os').cpus().length
const {parseListenTimeout, parsePort} = require('./util')

module.exports = (env, settings) => {
  if (cluster.isWorker) {
    throw new Error('expected cluster to be supervisor')
  }

  const listenTimeout = parseListenTimeout(env)
  const port = parsePort(env)
  const timeouts = {}
  cluster.setupMaster(settings)

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork(env)
  }

  cluster.on('disconnect', (worker) => {
    setImmediate(() => {
      console.log(`worker ${worker.id} is disconnected`)
    })
  })

  cluster.on('error', (err) => {
    setImmediate(() => {
      console.error(`Error in supervisor: ${err.message}`)
    })
  })

  cluster.on('exit', (worker, code, signal) => {
    setImmediate(() => {
      if (signal) {
        console.log(`worker ${worker.pid} was killed by signal: ${signal}`)
      } else if (code !== 0) {
        console.log(`worker ${worker.pid} exited with error code: ${code}`)
      }
      console.log('restarting worker...')
      cluster.fork(env)
    })
  })

  cluster.on('fork', (worker) => {
    setImmediate(() => {
      if (listenTimeout && port) {
        timeouts[worker.id] = setTimeout(() => {
          worker.kill()
        }, listenTimeout)
      }
    })
  })

  cluster.on('listening', (worker, address) => {
    setImmediate(() => {
      if (listenTimeout && port) {
        clearTimeout(timeouts[worker.id])
      }
      console.log(`worker ${worker.id} is now listening on ${address.address}:${address.port}`)
    })
  })

  cluster.on('message', (worker, msg) => {
    setImmediate(() => {
      if (message.hasValidType(msg)) {
        cluster.emit(msg.type, worker, msg)
      } else {
        const err = new Error(`unexpected type: ${msg.type}`)
        cluster.emit('error', err)
      }
    })
  })

  cluster.on('online', (worker) => {
    setImmediate(() => {
      console.log(`worker ${worker.id} is running`)
    })
  })

  cluster.on(message.REQUEST, (worker, msg) => {
    setImmediate(() => {
      if (message.hasValidCode(msg)) {
        cluster.emit(msg.code, worker, msg)
      } else {
        const err = new Error(`unexpected code: ${msg.code}`)
        cluster.emit('error', err)
      }
    })
  })

  cluster.on(message.REPLY, (worker, msg) => {
    setImmediate(() => {
      cluster.emit(msg.txId, worker, msg)
    })
  })

  cluster.on(message.BROADCAST, (worker, msg) => {
    setImmediate(() => {
      Object.keys(cluster.workers).forEach((id) => {
        cluster.workers[id].send(msg)
      })
    })
  })

  cluster.on(message.DIRECT, (fromWorker, msg) => {
    setImmediate(() => {
      const toWorker = cluster.workers[msg.toId]
      if (toWorker) {
        toWorker.send(msg)
      } else {
        const err = new Error(`unexpected worker id: ${msg.toId}`)
        cluster.emit('error', err)
      }
    })
  })

  return cluster
}