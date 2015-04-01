#!/usr/bin/env node
'use strict';

var async = require('async');

var proxy = require('./lib/proxy');
var logger = require('./lib/logger');
var browserListenerProxy = require('./lib/proxy/browserListenerProxy');
var p, options = {}, bt;
var deasync = require('deasync');
var Browsertime = require('./lib/browsertime');

module.exports.createStatisticUnit = function (browser) {
  options.browser = browser;
  logger.addLog(null, options);
  p = proxy.createProxy(options);

  var done = false;

  async.series(
    [
      function (cb) {
        p.launchProcess(cb);
      },
      function (cb) {

        bt = new Browsertime(options.browser);

        browserListenerProxy.setup(bt, p, options);
        cb();
        //bt.fetch(argv, cb);
      }
    ], function (err) {
      done = true;
    }
  );
  while (!done) {
    deasync.runLoopOnce();
  }
};

module.exports.getWithStatistic = function(url, harFileName, timingFileName){
  var done = false;
  options.url = url;
  options.filename = timingFileName;
  options.harFile = harFileName;
  bt.fetch(options, function(){
    done = true;
  });
  while (!done) {
    deasync.runLoopOnce();
  }
};

module.exports.destroyStatisticUnit = function(){
  p.stopProcess(function () {});
};

