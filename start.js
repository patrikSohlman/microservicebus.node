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

'use strict';

require('colors');
var debug = process.execArgv.find(function (e) {  return e.startsWith('--debug');}) !== undefined;

if (debug) {
    console.log("Start with debug");
    start(true);
}
else {
    //console.log("Start without debug");
    startWithoutDebug();
}

function startWithoutDebug() {
    var cluster = require('cluster');
    var DebugHost = new require("./lib/DebugHost.js");
    var debugHost;
    if (cluster.isMaster) {
        //cluster.setupMaster({
        //    execArgv: process.execArgv.filter(function (s) { return s !== '--debug-brk=33000 --nolazy' })
        //});
                
        var worker = cluster.fork();

        cluster.on('exit', function (worker, code, signal) {
            cluster.fork();

            if (debugHost) {
                debugHost.Start();
            }
        });

        cluster.on('message', function (msg) {
            var fixedExecArgv = [];
            fixedExecArgv.push('--debug-brk=33000');
            cluster.setupMaster({
                execArgv: fixedExecArgv
            });

            debugHost = new DebugHost();
            debugHost.OnReady(function () {
                
            });
            debugHost.OnStopped(function () {

            });

            

            //if (msg.chat === "abort") {
            //    process.abort();
            //}
            //else if (msg.chat == "restart") {
            //    cluster.destroy();
            //}
            //else if (msg.chat == "debug") {
            //    var fixedExecArgv = [];
            //    fixedExecArgv.push('--debug-brk=33000');
            //    cluster.setupMaster({
            //        execArgv: fixedExecArgv
            //    });
            //    cluster.destroy();
            //}
        });
    }

    if (cluster.isWorker) {
        console.log("start worker");
        start();
    }
}

function start(d) {
    var util = require('./lib/Utils.js');
    var pjson = require('./package.json');
    var checkVersion = require('package-json');
    var npm = require('npm');
    var fs = require('fs');
    var started = false;
    var maxWidth = 75;
    let args = process.argv.slice(1);
    var rootFolder = process.arch == 'mipsel' ? '/mnt/sda1' : __dirname;

    console.log();
    console.log(util.padRight("", maxWidth, ' ').bgBlue.white.bold);
    console.log(util.padRight(" microServicebus.com", maxWidth, ' ').bgBlue.white.bold);
    console.log(util.padRight(" Node.js version    : " + process.version, maxWidth, ' ').bgBlue.white);
    console.log(util.padRight(" NPM package version: " + pjson.version, maxWidth, ' ').bgBlue.white);
    console.log(util.padRight(" Architecture       : " + process.arch, maxWidth, ' ').bgBlue.white);
    console.log(util.padRight(" For more information visit: http://microservicebus.com", maxWidth, ' ').bgBlue.white);
    console.log(util.padRight(" GIT repository: https://github.com/microServiceBus/microservicebus.node", maxWidth, ' ').bgBlue.white);
    console.log(util.padRight("", maxWidth, ' ').bgBlue.white.bold);

    console.log();
    
    // Check if there is a later npm package
    checkVersion("microservicebus.node")
        .then(function (rawData) {
            var latest = rawData['dist-tags'].latest;
            if (util.compareVersion(pjson.version, latest) < 0) {
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
            "hubUri": "wss://microservicebus.com"
        }
        if (fs.existsSync(rootFolder + '/lib/settings.json')) {
            var data = fs.readFileSync(rootFolder + '/lib/settings.json');
            settings = JSON.parse(data);
        }
    }
    catch (err) {
        console.log('Invalid settings file.'.red);
        console.log(err);
        process.abort();
    }

    var MicroServiceBusHost = require("./lib/microServiceBusHost.js");
    var microServiceBusHost = new MicroServiceBusHost(settings);

    microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
        if (settings.trackMemoryUsage != undefined && settings.trackMemoryUsage > 0) {
            console.log("");
            console.log("---------------------------------------------------------------------------".bgBlue.white.bold)
            console.log("|          rss           |        heapTotal       |        heapUsed       |".bgBlue.white.bold)
            console.log("---------------------------------------------------------------------------".bgBlue.white.bold)

            if (!started) {
                started = true;
                setInterval(function () {
                    memUsage = process.memoryUsage();

                    var str = "|" + util.padLeft(memUsage.rss.toLocaleString(), 23, ' ') + " |" + util.padLeft(memUsage.heapTotal.toLocaleString(), 23, ' ') + " |" + util.padLeft(memUsage.heapUsed.toLocaleString(), 22, ' ') + " |";
                    console.log(str.bgBlue.white.bold);

                }, settings.trackMemoryUsage);
            }
        }
    });
    microServiceBusHost.OnStopped(function () {

    });
    microServiceBusHost.OnUpdatedItineraryComplete(function () {

    });
    
    checkVersion("microservicebus.core")
        .then(function (rawData) {
            var packageFile = rootFolder + '/node_modules/microservicebus.core/package.json';
            var corePjson;

            if (fs.existsSync(packageFile)) {
                corePjson = require(packageFile);
            }
            var latest = rawData['dist-tags'].latest;

            if (corePjson === undefined || util.compareVersion(corePjson.version, latest) < 0) {
                var version = corePjson === undefined ? "NONE" : corePjson.version;
                console.log();
                console.log(util.padRight("", maxWidth, ' ').bgGreen.white.bold);
                console.log(util.padRight(" New version of Core available. Performing update, please wait...", maxWidth, ' ').bgGreen.white.bold);
                console.log(util.padRight(" Current version: " + version + ". New version: " + latest, maxWidth, ' ').bgGreen.white.bold);
                console.log(util.padRight("", maxWidth, ' ').bgGreen.white.bold);
                console.log();

                util.addNpmPackage("microservicebus.core", true, function (err) {
                    if (err) {
                        console.log("Unable to install core update".bgRed.white);
                    }
                    microServiceBusHost.Start();
                });
            }
            else {
                microServiceBusHost.Start(d);
            }
        });

}