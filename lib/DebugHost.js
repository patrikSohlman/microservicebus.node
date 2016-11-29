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
var colors = require('colors');
var signalR = require('./signalR.js');
var fs = require('fs');
var path = require('path');
var rootFolder = process.arch == 'mipsel' ? '/mnt/sda1' : __dirname;

function DebugHost() {
    var self = this;
    // Events
    this.onReady;
    this.onStopped;
    this.settings = {};
    var bm;
    var sm;
    var DebugClient = require('v8-debug-protocol')
    var debugClient;
    var ScriptManager = DebugClient.ScriptManager;
    const SERVICEFOLDER = "./node_modules/microservicebus.core/lib/services/";

    DebugHost.prototype.OnReady = function (callback) {
        this.onReady = callback;
    };
    DebugHost.prototype.OnStopped = function (callback) {
        this.onStopped = callback;
    };
    
    DebugHost.prototype.Start = function () {
        setUpClient(function () {
            signalRClient.start();
            
        });
    };
    DebugHost.prototype.Stop = function (callback) {
        signalRClient.end();
        debugClient.disconnect();
        callback();
    };
    var settings = {
        "debug": false,
        "hubUri": "wss://microservicebus.com"
    }
    var data = fs.readFileSync('./lib/settings.json');
    self.settings = JSON.parse(data);

    var signalRClient = new signalR.client(
        self.settings.hubUri + '/signalR',
        ['integrationHub'],
        10, //optional: retry timeout in seconds (default: 10)
        true
    );

    // Private methods
    function log(msg){
        console.log(msg.bgYellow.black);
    }
    function debugLog(msg) {
        console.log(msg.bgRed.black);
    }
    function setUpClient(callback) {
        signalRClient.serviceHandlers = {
            bound: function () { log("Connection: " + "bound"); },
            connectFailed: function (error) {
                log("Connection: " + "Connect Failed");
            },
            connected: function (connection) {
                log("Connection: " + "Connected!");
                signalRClient.invoke('integrationHub', 'debug_signIn', self.settings.nodeName, self.settings.organizationId);
                initDebugClient();
            },
            disconnected: function () {

                log("Connection: " + "Disconnected");

            },
            onerror: function (error) {
                log("Connection: " + "Error: ", error);
            },
            messageReceived: function (message) {

            },
            bindingError: function (error) {
                log("Connection: " + "Binding Error: " + error);
            },
            connectionLost: function (error) {
                //_isWaitingForSignInResponse = false;
                log("Connection: " + "Connection Lost");
            },
            reconnected: void function (connection) {
                log("Connection: " + "Reconnected ");
            },
            onUnauthorized: function (res) { },
            reconnecting: function (retry /* { inital: true/false, count: 0} */) {
                log("Connection: " + "Retrying to connect ");
                return true;
            }
        };

        signalRClient.on('integrationHub', 'debug_signedInComplete', function (message) {
            log("debug_signedInComplete");
            //self.onReady();
        });
        signalRClient.on('integrationHub', 'debug_continue', function (message) {
            log("debug_continue");
            debugClient.continue(function (err, doneOrNot) { }); 
        });
        signalRClient.on('integrationHub', 'debug_stepIn', function (message) {
            log("debug_stepIn");
        });
        signalRClient.on('integrationHub', 'debug_stepOver', function (message) {
            log("debug_stepOver");
        });
        signalRClient.on('integrationHub', 'debug_stop', function (message) {
            log("Disabling debug!");
            self.onStopped();
        });
        callback();
    }
    function initDebugClient() {
        debugClient = new DebugClient(5859);

        debugClient.on('connect', function () {
            debugLog("Debugger Connected");
            bm = new DebugClient.BreakPointManager(debugClient);
            sm = new ScriptManager(debugClient);

            //bm.createBreakpoint("./lib/microServiceBusHost.js", 55, 'true === true')
            //    .then(function (breakpoint) {
            //        debugLog("breakpoint #1 set");
            //    });

            //bm.createBreakpoint("./lib/microServiceBusHost.js", 59, 'true === true')
            //    .then(function (breakpoint) {
            //        debugLog("breakpoint #2 set");
            //    });

            //var serviceFile = path.join(SERVICEFOLDER, "simulatorTemperatureSensor.js");

            //if (fs.existsSync(serviceFile)) {
            //    bm.createBreakpoint(serviceFile, 20, 'true === true')
            //        .then(function (breakpoint) {
            //            debugLog("breakpoint in simulatorTemperatureSensor set");
            //        });
            //}
        });

        debugClient.on('break', function (breakInfo) {
             sm.fetch({
                 type: NORMAL_SCRIPTS,
                 ids: [breakInfo.scripts.id],
                 includeSource: true
             })
             .then(function(){
                 debugLog('sadf');
             });
        })
    }
}
module.exports = DebugHost;