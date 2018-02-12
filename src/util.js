'use strict'

exports.parseListenTimeout = (env) => {
  try {
    const listenTimeout = parseInt(env.LISTEN_TIMEOUT, 10)
    return listenTimeout
  } catch (err) {
    return null
  }
}

exports.parsePort = (env) => {
  let port = null
  try {
    port = parseInt(env.PORT, 10)
  } catch (err) {
    return port
  }
  if (port > 1023) {
    return port
  }
  return null
}