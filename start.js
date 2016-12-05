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
var util = require('./lib/Utils.js');
var pjson = require('./package.json');
var checkVersion = require('package-json');
var npm = require('npm');
var fs = require('fs');
var maxWidth = 75;
var debugPort = 5859;

var debug = process.execArgv.find(function (e) {  return e.startsWith('--debug');}) !== undefined;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

if (debug) {
    console.log("Start with debug");
    start(true);
}
else {
    startWithoutDebug();
}

function startWithoutDebug() {
    var cluster = require('cluster');
    
    var debugHost;
    var fixedExecArgv = [];
    if (cluster.isMaster) {
        var worker = cluster.fork();

        cluster.on('exit', function (worker, code, signal) {
            worker = cluster.fork();

            if (cluster.settings.execArgv.find(function (e) { return e.startsWith('--debug'); }) !== undefined) {

                console.log();
                console.log(util.padRight("", maxWidth, ' ').bgGreen.white.bold);
                console.log(util.padRight(" IN DEBUG", maxWidth, ' ').bgGreen.white.bold);
                console.log(util.padRight("", maxWidth, ' ').bgGreen.white.bold);
                console.log();

                debugHost.Start(debugPort);
                debugPort++;
            }
            else {
                console.log();
                console.log(util.padRight(" NORMAL START", maxWidth, ' ').bgGreen.white.bold);
                console.log();

                debugHost = undefined;
            }
        });

        cluster.on('message', function (msg) {
            if (debugHost == undefined) {
                fixedExecArgv.push('--debug-brk');

                cluster.setupMaster({
                    execArgv: fixedExecArgv
                });
                var DebugHost = require("microservicebus.core").DebugClient;

                debugHost = new DebugHost();
                debugHost.OnReady(function () {

                });
                debugHost.OnStopped(function () {
                    console.log(util.padRight(" OnStop process triggered", maxWidth, ' ').bgGreen.white.bold);
                    cluster.setupMaster({
                        execArgv: []
                    });
                    debugHost = undefined;

                    for (var id in cluster.workers) {
                        console.log(util.padRight(" Killing", maxWidth, ' ').bgGreen.white.bold);
                        cluster.workers[id].process.disconnect();
                        cluster.workers[id].process.kill('SIGTERM');
                    }
                });
            }
            else {
                debugHost.Stop(function () {
                    cluster.setupMaster({
                        execArgv: []
                    });
                    for (var id in cluster.workers) {
                        console.log(util.padRight(" Killing", maxWidth, ' ').bgGreen.white.bold);
                        cluster.workers[id].process.disconnect();
                        cluster.workers[id].process.kill('SIGTERM');
                    }

                });
                
            }
            
        });
    }

    if (cluster.isWorker) {
        console.log("start worker");
        start();
    }
    process.on('uncaughtException', function (err) {
        if (err.errno === 'ECONNREFUSED') {
            for (var id in cluster.workers) {
                debugHost = undefined;
                console.log(util.padRight(" Killing", maxWidth, ' ').bgRed.white.bold);
                cluster.workers[id].process.disconnect();
                cluster.workers[id].process.kill('SIGTERM');
            }
        }
        else
            console.log('Uncaught exception: '.red + err);
    });
}

function start(d) {
    var started = false;
    
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