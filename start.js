require('colors');
var util = require('./Utils.js');
var pjson = require('./package.json');
var checkVersion = require('package-json');
var fs = require('fs');
var compareVersion = require('compare-version');

var maxWidth = 75;

console.log();
console.log(util.padRight("", maxWidth, ' ').bgBlue.white.bold);
console.log(util.padRight(" microServicebus.com", maxWidth, ' ').bgBlue.white.bold);
console.log(util.padRight(" NPM package version: " + pjson.version, maxWidth, ' ').bgBlue.white);
console.log(util.padRight(" Architecture:        " + process.arch, maxWidth, ' ').bgBlue.white);
console.log(util.padRight(" For more information visit: http://microservicebus.com", maxWidth, ' ').bgBlue.white);
console.log(util.padRight(" GIT repository: https://github.com/microServiceBus/microservicebus.node", maxWidth, ' ').bgBlue.white);
console.log(util.padRight("", maxWidth, ' ').bgBlue.white.bold);

console.log();

// Check if there is a later npm package
checkVersion("microservicebus.node")
			.then(function (rawData) {
    var latest = rawData['dist-tags'].latest;
    if (compareVersion (pjson.version,latest) < 0) {
        console.log();
        console.log(util.padRight("", maxWidth, ' ').bgRed.white.bold);
        console.log(util.padRight("There is a new version of microservicebus.node: " + latest, maxWidth, ' ').bgRed.white.bold);
        console.log(util.padRight("type: 'npm update microservicebus.node' ", maxWidth, ' ').bgRed.gray.bold);
        console.log(util.padRight(" from the root folder to get the latest version", maxWidth, ' ').bgRed.gray.bold);
        console.log(util.padRight("", maxWidth, ' ').bgRed.white.bold);
        console.log();
        
    }
});

// Load settings
try {
    var settings = {
        "debug": false,
        "hubUri": "wss://microservicebus.com",
        "port": 80
    }
    if (fs.existsSync('./settings.json')) {
        var data = fs.readFileSync('./settings.json');
        settings = JSON.parse(data);
    }
}
catch (err) {
    console.log('Invalid settings file.'.red);
    process.abort();
}
    
var MicroServiceBusHost = require("./microServiceBusHost.js");
var microServiceBusHost = new MicroServiceBusHost(settings);

microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
    
});

microServiceBusHost.Start();
