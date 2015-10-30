#!/usr/bin/env node
'use strict';

var path = require("path"),
    async = require("async"),
    spawn = require("cross-spawn"),
    fs = require("fs"),
    mobproxyClass = require("browsermob-proxy-api"),
    stats = require("./lib/statistics"),
    helper = require("./lib/helper"),
    mobproxyAPI,
    result,
    scripts = {},
    defaultWaitScript = 'return window.performance.timing.loadEventEnd>0',
    mobproxyIsRun = false,
    unitData = {
      proxy : {
        controlport: 8888,
        port : 9000,
        host : "127.0.0.1",
        startupTime : 15000,
        maxPageLoadTimeout : 6000
      }
    },
    proxyProcess,
    timeout;

function setConfig(options){
  unitData.browser = options.browser;
  if (options.proxy) {
    unitData.proxy.controlport = options.proxy.controlport || unitData.proxy.controlport;
    unitData.proxy.port = options.proxy.port || unitData.proxy.port;
    unitData.proxy.host = options.proxy.host || unitData.proxy.host;
    unitData.proxy.hosts = options.proxy.hosts;
    unitData.proxy.connectionRaw = options.proxy.connectionRaw;

    if (options.proxy.connectionType) {
      if (options.proxy.connectionType === 'mobile3g') {
        unitData.proxy.connectionRaw = {
          downstreamKbps: 1600,
          upstreamKbps  : 768,
          latency       : 300
        };
      } else if (options.proxy.connectionType === 'mobile3gfast') {
        unitData.proxy.connectionRaw = {
          downstreamKbps: 1600,
          upstreamKbps  : 768,
          latency       : 150
        };
      } else if (options.proxy.connectionType === 'cable') {
        unitData.proxy.connectionRaw = {
          downstreamKbps: 5000,
          upstreamKbps  : 1000,
          latency       : 28
        };
      }
    }
  }
}

function loadStatisticScripts() {
  var scriptRoots = path.join(__dirname,  'scripts');

  helper.readScripts(scriptRoots, scripts);
}

function startProxy(){
  var done = false,
      cb = function (){ done = true; };

  mobproxyAPI = new mobproxyClass(
    {
      "host": unitData.proxy.host,
      "port": unitData.proxy.controlport
    }
  );
  mobproxyAPI.startPort(unitData.proxy.port);
  setTimeout(cb, 1000);
  while (!done) {
    require("deasync").runLoopOnce();
  }
}

module.exports.createStatisticUnit = function (options) {
  var done = false,
      cb = function (){done = true};

  function tailStdOutForSuccess(data) {
    if (data.toString().indexOf('Started SelectChannelConnector') > -1) {
      mobproxyIsRun = true;
      clearTimeout(timeout);
      cb();
    }
  }

  function tailStdErrForFailure(data) {
    var logLine = data.toString();

    if (logLine.indexOf('Started SelectChannelConnector') > -1) {
      mobproxyIsRun = true;
      clearTimeout(timeout);
      cb();
    } else if (logLine.indexOf('FAILED ') > -1) {
      clearTimeout(timeout);
      console.log('proxy failed to start: ' + logLine)
      cb();
    }
  }

  function endWithTimeout() {
    console.log('timeout, waited ' + unitData.proxy.startupTime + ' milliseconds, and proxy didn\'t start')
    cb();
  }

  setConfig(options);

  var jarPath = path.join(__dirname, "lib", "proxy", 'bmpwrapper-2.0.0-full.jar');
  proxyProcess = spawn('java', ['-jar', jarPath, '-port', unitData.proxy.controlport]);

  var timeout = setTimeout(endWithTimeout, unitData.proxy.startupTime);

  proxyProcess.stdout.on('data', function(data) {
    console.log('stdout:' + data);
  }).on('data', tailStdOutForSuccess);

  proxyProcess.stderr.on('data', function(data) {
    console.log('stderr:' + data);
  }).on('data', tailStdErrForFailure);

  // yep must be better way to make sure that the proxy always
  // is shutdown but leave it like this for now.
  var self = this;
  process.on('uncaughtException', function(err) {
    console.log(err);
    self.destroyStatisticUnit();
  });

  while (!done) {
    require("deasync").runLoopOnce();
  }

  if (mobproxyIsRun){
    startProxy();
    loadStatisticScripts();
  }
};

function startHar(){
  var done = false,
      cb = function (){done = true},
      proxySetupTasks = [];

  proxySetupTasks.push(function(callback) {
    mobproxyAPI.clearDNSCache(unitData.proxy.port, callback);
  });

  proxySetupTasks.push(function(callback) {
    mobproxyAPI.setDNSLookupOverride(unitData.proxy.port, JSON.stringify(unitData.proxy.hosts), callback);
  });

  if (unitData.proxy.headers) {
    proxySetupTasks.push(function(callback) {
      mobproxyAPI.setHeaders(unitData.proxy.port, JSON.stringify(unitData.proxy.headers), callback);
    });
  }
  if (unitData.proxy.basicAuth) {
    proxySetupTasks.push(function(callback) {
      mobproxyAPI.setAuthentication(unitData.proxy.port, self.domain, JSON.stringify(unitData.proxy.basicAuth), callback);
    });
  }
  if (unitData.proxy.connectionRaw) {
    proxySetupTasks.push(function(callback) {
      mobproxyAPI.limit(unitData.proxy.port, unitData.proxy.connectionRaw, callback);
    });
  }
  proxySetupTasks.push(function(callback) {
    mobproxyAPI.createHAR(unitData.proxy.port, {'captureHeaders': true}, callback);
  });

  async.series(proxySetupTasks, cb);

  while (!done) {
    require("deasync").runLoopOnce();
  }

}

function populatePromises (promises) {
  Object.keys(scripts).forEach(function(scriptName) {
    promises.push(
      {
        name   : scriptName,
        promise: unitData.browser.executeScript(scripts[scriptName])
      }
    );
  });
}

module.exports.startHar = startHar;

function saveHar(harFileName, result, cb){
  mobproxyAPI.getHAR(unitData.proxy.port, function(err, har) {
    if (err) {
      console.log(err);
      return cb(err);
    }

    var theHar;
    try {
      theHar = JSON.parse(har);
    } catch (err) {
      console.log(err);
      return cb(err);
    }

    // TODO this is a hack and need to be cleaned up in the future
    for (var i = 0; i < theHar.log.pages.length; i++) {
      theHar.log.pages[i].comment = result.url;
      if (result.default.data[i]) {
        theHar.log.pages[i].title = result.default.data[i].documentTitle;
        theHar.log.pages[i].pageTimings.onContentLoad = result.default.data[i].timings.domContentLoadedTime;
        theHar.log.pages[i].pageTimings.onLoad = result.default.data[i].timings.pageLoadTime;
        Object.keys(result.default.data[i].timings).forEach(function(timing) {
          theHar.log.pages[i]['_' + timing] = result.default.data[i].timings[timing];
        });

        theHar.log.pages[i]._speedIndex = result.default.data[i].speedIndex;
        theHar.log.pages[i]._firstPaint = result.default.data[i].firstPaint;
      }
    }
    fs.writeFile(harFileName, JSON.stringify(theHar), function(e) {
      return cb(e);
    });
  });
}

module.exports.saveHar = saveHar;

function getFormattedResult (results, url) {
  // fetch timings for each run and make some statistics
  var defaultData = {},
      self = this;

  results.default.forEach(function(run) {
    Object.keys(scripts).forEach(function(scriptName) {
      stats.setupTimingsStatistics(defaultData, run);
      stats.setupUserTimingsStatistics(defaultData, run);
      // for all scripts that return numbers automatically
      // include them in the statistics
      if (helper.isNumber(run[scriptName])) {
        stats.setupStatistics(defaultData, run, scriptName);
      }
    });

    // Ugly hack: Firefox has an extra toJSON method in the resource timings
    // lets skip that for the result
    if (run.resourceTimings) {
      run.resourceTimings.forEach(function(entry) {
        if (entry.toJSON) {
          entry.toJSON = undefined;
        }
      });
    }

  });

  var driver = unitData.browser.driver,
      temp = {};

  driver.getCapabilities().then(function(cap) {
    temp.browserVersion = cap.get('version');
    temp.os = cap.get('platform');
    temp.browserName = cap.get('browserName');
  });

  return {
    url: url,
    browserName: temp.browserName,
    browserVersion: temp.browserVersion,
    platform: temp.os,
    default: {
      statistics: stats.formatStatistics(defaultData),
      data: results.default
    }
  };

}

function saveToFile (data, filename, harFileName, cb) {
  var self = this;

  // lets store the files
  async.parallel(
    [
      function (callback) {
        fs.writeFile(
          filename, JSON.stringify(data), function (err) {
            console.log(err);
            callback(err);
          }
        );
      },
      function (callback) {
        saveHar(harFileName, data, callback);
      }
    ], cb
  );
}

module.exports.getWithStatistic = function(url, harFileName, timingFileName){
  var result = {
    default: [],
    custom: []
  };

  startHar();

  async.series(
    [
      function(callback){
        unitData.browser.get(url);

        var afterFetchTime = Date.now();

        unitData.browser.wait(
          function () {
            return unitData.browser.executeScript(defaultWaitScript).then(
              function (b) {
                return b;
              }
            );
          },
          unitData.proxy.maxPageLoadTimeout
        ).then(
          function () {
            var afterLoadTime = Date.now();


            console.log(
              'loading url took %d milliseconds', (
              afterLoadTime - afterFetchTime
              )
            );
            // This is needed since the Firefox driver executes the success callback even when driver.wait
            // took too long.
            if ( (afterLoadTime - afterFetchTime) > unitData.proxy.maxPageLoadTimeout) {
              console.log('The url ' + url + ' timed out');
              callback();
            }

            var promises = [];
            populatePromises(promises);

            var callbacks = [];
            promises.forEach(function(promise) {
              callbacks.push(function(cb2) {
                promise.promise.then(function(value) {
                  var result = {
                    name: promise.name,
                    value: value,
                    custom: promise.custom || false
                  };
                  cb2(null, result);
                }, function(e) {
                  console.log('Error running script \'%s\': %s', promise.name, util.inspect(e));
                  cb2(e);
                });
              });
            });

            // when we are finished, push the result and stop the browser
            async.series(callbacks,
                         function(e, results) {
                           var data = {};
                           results.forEach(function(metric) {
                             data[metric.name] = metric.value;
                           });
                           data.date = new Date(afterFetchTime);
                           result.default.push(data);
                           console.log(result);
                           callback();
                         });
          },
          function() {
            var afterLoadTime = Date.now();
            console.log('loading url took %d milliseconds', (afterLoadTime - afterFetchTime));
            callback();
          }
        );
      },
      function(callback){
          var data = getFormattedResult(result, url);
          saveToFile(data, timingFileName, harFileName, callback);
      }
    ], function () {});
};

module.exports.destroyStatisticUnit = function(){
var done = false,
    cb = function (){done = true};

proxyProcess.removeAllListeners();

mobproxyAPI.stopPort(unitData.proxy.port, function(){});

setTimeout(function(){
  // special handling for Windows
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', proxyProcess.pid, '/f', '/t']);
    console.log('Stopped proxy process.');
  } else {
    var killed = proxyProcess.kill();
    if (!killed) {
      console.log('Failed to stop proxy process.');
    } else {
      console.log('Stopped proxy process.');
    }
  }
  cb();
}, 500);
while (!done) {
  require("deasync").runLoopOnce();
}
};