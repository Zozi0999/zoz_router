/**
 * Vercel Serverless Function Fallback Entrypoint for ZOZ ROUTER
 * File: api/index.js
 *
 * Meneruskan panggilan langsung pada root endpoint (/api dan /api/)
 * ke native catch-all gateway [...slug].js secara konsisten.
 */

const catchAllHandler = require('./[...slug].js');

module.exports = async function handler(req, res) {
  return catchAllHandler(req, res);
};
