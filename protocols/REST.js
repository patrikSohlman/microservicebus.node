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
var crypto = require('crypto');
var httpRequest = require('request');
var storage = require('node-persist');
var util = require('../Utils.js');
var guid = require('uuid');
var moment = require('moment');

function REST(nodeName, sbSettings) {
    var storageIsEnabled = true;
    var stop = false;
    var me = this;
    var restMessagingToken = sbSettings.messagingToken;
    var restTrackingToken = sbSettings.trackingToken;
    var baseAddress = "https://" + sbSettings.sbNamespace;
    
    if (!baseAddress.match(/\/$/)) {
        baseAddress += '/';
    }
         
    REST.prototype.Start = function () {
        stop = false;
        me = this;
         // Weird, but unless I thorow away a dummy message, the first message is not picked up by the subscription
        this.Submit("{}", nodeName, "--dummy--");
        
        this.Listen();
    };
    REST.prototype.Stop = function () {
        stop = true;
    };
    REST.prototype.Submit = function (message, node, service) {
        try {
            var me = this;
            if (stop) {
                var persistMessage = {
                    node: node,
                    service: service,
                    message: message
                };
                if (storageIsEnabled)
                    storage.setItem(guid.v1(), persistMessage);
                
                return;
            }
            var submitUri = baseAddress + sbSettings.topic + "/messages" + "?timeout=60"
            
            httpRequest({
                headers: {
                    "Authorization": restMessagingToken, 
                    "Content-Type" : "application/json",
                    "node": node.toLowerCase(),
                    "service" : service
                },
                uri: submitUri,
                json: message,
                method: 'POST'
            }, 
            function (err, res, body) {
                if (err != null) {
                    me.onQueueErrorSubmitCallback("Unable to send message");
                    var persistMessage = {
                        node: node,
                        service: service,
                        message: message
                    };
                    if (storageIsEnabled)
                        storage.setItem(message.InterchangeId, persistMessage);
                }
                else if (res.statusCode >= 200 && res.statusCode < 300) {
                    // All good
                }
                else if (res.statusCode == 401) { //else if (res.statusCode == 401 && res.statusMessage == '40103: Invalid authorization token signature') {
                    // Outdated token
                    me.onQueueDebugCallback("Expired token. Updating token...");
                    acquireToken("MICROSERVICEBUS", "MESSAGING", restMessagingToken, function (token) {
                        if (token == null && storageIsEnabled) {
                            me.onQueueErrorSubmitCallback("Unable to aquire messaging token: " + token);
                            storage.setItem(message.instanceId, persistMessage);
                            return;
                        }
                        restMessagingToken = token;
                        me.Submit(message, node, service);
                    })
                    return;
                }
                else {
                    console.log("Unable to send message");
                    var persistMessage = {
                        node: node,
                        service: service,
                        message: message
                    };
                    if (storageIsEnabled)
                        storage.setItem(message.instanceId, persistMessage);
                }
            });

        }
        catch (err) {
            console.log("from this.Submit");
        }
    };
    REST.prototype.Track = function (trackingMessage) {
        try {
            if (stop) {

                if (storageIsEnabled)
                    storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                
                return;
            }

            var trackUri = baseAddress + sbSettings.trackingHubName + "/messages" + "?timeout=60";
            
            httpRequest({
                headers: {
                    "Authorization": restTrackingToken, 
                    "Content-Type" : "application/json",
                },
                uri: trackUri,
                json: trackingMessage,
                method: 'POST'
            }, 
            function (err, res, body) {
                if (err != null) {
                    me.onQueueErrorSubmitCallback("Unable to send message. " + err.code + " - " + err.message);
                    console.log("Unable to send message. " + err.code + " - " + err.message);
                    if (storageIsEnabled)
                        storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                }
                else if (res.statusCode >= 200 && res.statusCode < 300) {
                }
                else if (res.statusCode == 401) {
                    me.onQueueDebugCallback("Expired tracking token. Updating token...");
                    acquireToken("MICROSERVICEBUS", "TRACKING", restTrackingToken, function (token) {
                        if (token == null && storageIsEnabled) {
                            me.onQueueErrorSubmitCallback("Unable to aquire tracking token: " + token);
                            storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                            return;
                        }
                        
                        restTrackingToken = token;
                        me.Track(trackingMessage);
                    });
                    return;
                }
                else {
                    console.log("Unable to send message. " + res.statusCode + " - " + res.statusMessage);

                }
            });
        }
        catch (err) {
            console.log();
        }
    };
    REST.prototype.Listen = function () {
        try {
            var me = this;
            if (stop) {
                me.onQueueDebugCallback("Queue listener is stopped");
                
                return;
            }
            var listenUri = baseAddress + sbSettings.topic + "/Subscriptions/" + nodeName + "/messages/head" + "?timeout=60"
            
            httpRequest({
                headers: {
                    "Authorization": restMessagingToken, 
                },
                uri: listenUri,
                method: 'DELETE'
            }, 
            function (err, res, body) {
                
                if (err != null) {
                    me.onQueueErrorReceiveCallback("Unable to receive message. " + err.code + " - " + err.message);
                    console.log("Unable to receive message. " + err.code + " - " + err.message);
                }
                else if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        if (res.statusCode == 204) {
                            me.Listen();
                            return;
                        }
                        var service = res.headers.service.replace(/"/g, '');
                        if (service != "--dummy--") {
                            
                            var message = JSON.parse(res.body);
                            var responseData = {
                                body : message,
                                applicationProperties: { value: { service: service } }
                            }
                            me.onQueueMessageReceivedCallback(responseData);
                        }
                    }
                    catch (listenerror) {
                        console.log("Unable to parse incoming message. " + listenerror.code + " - " + listenerror.message);
                    }
                }
                else if (res.statusCode == 401) {
                    // Outdated token
                    me.onQueueDebugCallback("Expired messaging token. Updating token...");
                    acquireToken("MICROSERVICEBUS", "MESSAGING", restMessagingToken, function (token) {
                        if (token == null && storageIsEnabled) {
                            me.onQueueErrorSubmitCallback("Unable to aquire messaging token: " + token);
                            me.Listen();
                            return;
                        }
                        restMessagingToken = token;
                        me.Listen();
                    })
                    
                    return;
                }
                else {
                    console.log("Unable to send message. " + res.statusCode + " - " + res.statusMessage);
                }
                me.Listen();
            });

        }
        catch (err) {
            console.log(err);
        }
    }
    REST.prototype.Update = function (settings) {
        restMessagingToken = settings.messagingToken;
        restTrackingToken = settings.trackingToken;
    };
    function acquireToken(provider, keyType, oldKey, callback) {
        try {
            var acquireTokenUri = me.hubUri.replace("wss:", "https:") + "/api/Token";
            var request = {
                "provider": provider,
                "keyType": keyType,
                "oldKey": oldKey
            }
            httpRequest({
                headers: {
                    "Content-Type" : "application/json",
                },
                uri: acquireTokenUri,
                json: request,
                method: 'POST'
            }, 
            function (err, res, body) {
                if (err != null) {
                    me.onQueueErrorSubmitCallback("Unable to acquire new token. " + err.message);
                    callback(null);
                }
                else if (res.statusCode >= 200 && res.statusCode < 300) {
                    var time = moment();
                    time = time.format('YYYY-MM-DD HH:mm:ss.SSS');
                    console.log(time);
                    callback(body.token);
                }
                else {
                    me.onQueueErrorSubmitCallback("Unable to acquire new token. Status code: " + res.statusCode);
                    callback(null);
                }
            });
        }
	    catch (err) {
            process.exit(1);
        }
    };
}
module.exports = REST;