const { getDefaultConfig } = require('expo/metro-config');
const { createCvDevProxy } = require('./server/cv-dev-proxy.cjs');

const config = getDefaultConfig(__dirname);
const previousEnhance = config.server.enhanceMiddleware;
const proxy = createCvDevProxy();
config.server.enhanceMiddleware = (middleware, server) => {
  const next = previousEnhance ? previousEnhance(middleware, server) : middleware;
  return (req, res, done) => proxy(req, res, () => next(req, res, done));
};
module.exports = config;
