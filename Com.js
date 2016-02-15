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
//var AMQPClient = require('amqp10').Client;
//var Policy = require('amqp10').Policy;
var crypto = require('crypto');
var httpRequest = require('request');
var storage = require('node-persist');
var util = require('./Utils.js');
var extend = require('extend');
var storageIsEnabled = true;

function Com(nodeName, sbSettings) {
    var sbSettings = sbSettings;
    var stop = false;
    try {
        storage.initSync(); // Used for persistent storage if off-line
    }
    catch (storageEx) {
        console.log("Local persistance is not allowed");
        storageIsEnabled = false;
    }
    sbSettings.sbNamespace = sbSettings.sbNamespace + '.servicebus.windows.net';
    
    this.onQueueMessageReceivedCallback = null;
    this.onQueueErrorReceiveCallback = null;
    this.onQueueErrorSubmitCallback = null;
    this.onQueueDebugCallback = null;
    
    Com.prototype.OnQueueMessageReceived = function (callback) {
        onQueueMessageReceivedCallback = callback;
    };
    Com.prototype.OnReceivedQueueError = function (callback) {
        onQueueErrorReceiveCallback = callback;
    };
    Com.prototype.OnSubmitQueueError = function (callback) {
        onQueueErrorSubmitCallback = callback;
    };
    Com.prototype.OnQueueDebugCallback = function (callback) {
        onQueueDebugCallback = callback;
    };
    
    Com.prototype.Start = function () {
    };
    Com.prototype.Stop = function () {
    };
    Com.prototype.Submit = function (message, node, service) {
    };
    Com.prototype.Track = function (trackingMessage) {
    };
    
    var Protocol = require('./protocols/REST.js');
    var protocol = new Protocol(nodeName, sbSettings);

    extend(this, protocol);
}
module.exports = Com;