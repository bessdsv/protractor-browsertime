console.log(__dirname);
var statistic = require("../browsertime.js");

exports.config = {
  /*"seleniumArgs": ["-Dwebdriver.ie.driver=" + path.join(__dirname, 'node_modules', 'protractor', 'selenium', 'IEDriverServer'),
                   "-Dwebdriver.chrome.driver=" + path.join(__dirname, 'node_modules', 'protractor', 'selenium', 'chromedriver')],*/
  "specs": ["tests/**/*.js"],
  "multiCapabilities": [
    /*{
      "browserName": "chrome",
      "proxy": {
        "proxyType": "manual",
        "httpProxy": "127.0.0.1:2001",
        "sslProxy": "127.0.0.1:2001"
      }
    }
    ,*/
    {
      "browserName": "firefox",
      "proxy": {
        "proxyType": "manual",
        "httpProxy": "127.0.0.1:2001",
        "sslProxy": "127.0.0.1:2001"
      }
    }
    /*,
    {
      "browserName": "ie"
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
    statistic.createStatisticUnit(browser);
  },
  "onComplete": function () {
    statistic.destroyStatisticUnit();
  }
};
