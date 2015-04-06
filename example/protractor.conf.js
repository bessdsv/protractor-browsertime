console.log(__dirname);
var statistic = require("../browsertime.js");
var path = require("path");
exports.config = {
  "seleniumArgs": ["-Dwebdriver.ie.driver=" + path.join( 'node_modules', 'protractor', 'selenium', 'IEDriverServer.exe'),
                   "-Dwebdriver.chrome.driver=" + path.join( 'node_modules', 'protractor', 'selenium', 'chromedriver.exe')],
  "specs": ["tests/**/*.js"],
  "multiCapabilities": [
    /*{
      "browserName": "chrome",
      "proxy": {
        "proxyType": "manual",
        "httpProxy": "127.0.0.1:9000",
        "sslProxy": "127.0.0.1:9000"
      }
    }*/
    //,
    {
      "browserName": "firefox",
      "proxy": {
        "proxyType": "manual",
        "httpProxy": "127.0.0.1:9000",
        "sslProxy": "127.0.0.1:9000"
      }
    }
   // ,
    /*{
      "browserName": "ie",
      "proxy": {
        "proxyType": "manual",
        "httpProxy": "127.0.0.1:9000",
        "sslProxy": "127.0.0.1:9000"
      }
    }*/
  ],
  /*global process*/
  "maxSessions": 1,
  "onPrepare": function() {
    /*global browser, jasmine*/
    browser.ignoreSynchronization = true;
    browser.driver.manage().window().setPosition(0, 0);
    browser.driver.manage().window().setSize(1024, 768);
    browser.getWithStatistic = statistic.getWithStatistic;
    statistic.createStatisticUnit({browser : browser});
  },
  "onComplete": function () {
    statistic.destroyStatisticUnit();
  }
};
