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
var rootFolder = process.arch == 'mipsel' ? '/mnt/sda1' : __dirname;

function DebugHost() {
    var client;
    var self = this;
    // Events
    this.onReady;
    this.onStopped;

    DebugHost.prototype.OnReady = function (callback) {
        this.ready = callback;
    };
    DebugHost.prototype.OnStopped = function (callback) {
        this.onStopped = callback;
    };
    
    DebugHost.prototype.Start = function () {
        setUpClient(function () {
            callback();
            client.start();
            client.invoke('integrationHub', 'debug_signIn', settings.nodeName, settings.organizationId);
        });
    };
    DebugHost.prototype.Stop = function (callback) {
        client.end();
    };

    // Private methods
    function log(msg){
        console.log(msg.bgYellow.black);
    }
    function setUpClient(callback) {
        var data = fs.readFileSync(rootFolder + './settings.json');
        this.settings = JSON.parse(data);
        client = new signalR.client(
            settings.hubUri + '/signalR',
            ['integrationHub'],
            10, //optional: retry timeout in seconds (default: 10)
            true
        );
        client.serviceHandlers = {
            bound: function () { log("Connection: " + "bound"); },
            connectFailed: function (error) {
                log("Connection: " + "Connect Failed");
            },
            connected: function (connection) {
                log("Connection: " + "Connected");
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
                log("Connection: " + "Binding Error: ", error);
            },
            connectionLost: function (error) {
                //_isWaitingForSignInResponse = false;
                log("Connection: " + "Connection Lost");
            },
            reconnected: void function (connection) {
                log("Connection: " + "Reconnected ");
            },
            reconnecting: function (retry /* { inital: true/false, count: 0} */) {
                log("Connection: " + "Retrying to connect ");
                return true;
            }
        };
        client.on('integrationHub', 'debug_signedInComplete', function (message) {
            self.onReady();
        });
        client.on('integrationHub', 'debug_continue', function (message) {
            log("debug_continue");
        });
        client.on('integrationHub', 'debug_stepIn', function (message) {
            log("debug_stepIn");
        });
        client.on('integrationHub', 'debug_stepOver', function (message) {
            log("debug_stepOver");
        });
        client.on('integrationHub', 'debug_stop', function (message) {
            log("debug_stop");
        });
        callback();
    }
}
module.exports = DebugHost;