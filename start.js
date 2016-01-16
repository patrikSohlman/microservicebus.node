/*
The MIT License (MIT)

Copyright (c) 2014 microServiceBus.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
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

function formatNumber(num) {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
}

microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
    if (settings.trackMemoryUsage != undefined && settings.trackMemoryUsage > 0) {
        console.log("");
        console.log("---------------------------------------------------------------------------".bgBlue.white.bold)
        console.log("|          rss           |        heapTotal       |        heapUsed       |".bgBlue.white.bold)
        console.log("---------------------------------------------------------------------------".bgBlue.white.bold)
        
        setInterval(function () {
            memUsage = process.memoryUsage();
            
            var str = "|" + util.padLeft(memUsage.rss.toLocaleString(), 23, ' ') + " |" + util.padLeft(memUsage.heapTotal.toLocaleString(), 23, ' ') + " |" + util.padLeft(memUsage.heapUsed.toLocaleString(), 22, ' ') + " |";
            console.log(str.bgBlue.white.bold);
        
        }, settings.trackMemoryUsage);
    }
});
microServiceBusHost.OnStopped(function () {
    
});
microServiceBusHost.OnUpdatedItineraryComplete(function () {
    
});

microServiceBusHost.Start();

