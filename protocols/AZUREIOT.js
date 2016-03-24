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
var AmqpWs = require('azure-iot-device-amqp-ws').AmqpWs;
var Client = require('azure-iot-device').Client;
var Amqp = require('azure-iot-device-amqp').Amqp;
var SharedAccessSignature = require('azure-iot-device').SharedAccessSignature;
var url = require("url");

var Message = require('azure-iot-device').Message;
var iothub = require('azure-iothub');

var crypto = require('crypto');
var httpRequest = require('request');
var storage = require('node-persist');
var util = require('../Utils.js');
var guid = require('uuid');

function AZUREIOT(nodeName, sbSettings) {
    var me = this;
    var stop = false;
    var storageIsEnabled = true;
    var sender;
    var receiver;
    var tracker;
    var tokenRefreshTimer;
    var tokenRefreshInterval = (sbSettings.tokenLifeTime * 60 * 1000) * 0.9;

    // Setup tracking
    var baseAddress = "https://" + sbSettings.sbNamespace;
    if (!baseAddress.match(/\/$/)) {
        baseAddress += '/';
    }
    var restTrackingToken = sbSettings.trackingToken;
    
    AZUREIOT.prototype.Start = function () {
        me = this;
        stop = false;
        
        sender = createSenderFromClientSharedAccessSignature(sbSettings.senderToken);
        receiver = createReceiverFromClientSharedAccessSignature(sbSettings.receiverToken);
        
        sender.open(function (err) {
            var self = me;
            if (err) {
                me.onQueueErrorReceiveCallback('Unable to connect to Azure IoT Hub (send) : ' + err);
            }
            else {
                me.onQueueDebugCallback("Sender is ready");
                receiver.open(function (err, transport) {
                    if (err) {
                        me.onQueueErrorReceiveCallback('Could not connect: ' + err.message);
                    } else {
                        me.onQueueDebugCallback("Receiver is ready");
                        receiver.on('message', function (msg) {
                            try {
                                var message = msg.data;
                                
                                var responseData = {
                                    body : message,
                                    applicationProperties: { value: { service: message.service } }
                                }
                                me.onQueueMessageReceivedCallback(responseData);
                                
                                receiver.complete(msg, function () {});
                            }
                            catch (e) {
                                me.onQueueErrorReceiveCallback('Could not connect: ' + e.message);
                            }
                        });
                    }
                });
            }
        });

        tokenRefreshTimer = setInterval(function () {
            me.onQueueDebugCallback("Update tracking tokens");
            acquireToken("AZUREIOT", "TRACKING", restTrackingToken, function (token) {
                if (token == null) {
                    me.onQueueErrorSubmitCallback("Unable to aquire tracking token: " + token);
                }
                else {
                    restTrackingToken = token;
                }
            });
        }, tokenRefreshInterval);
    };
    AZUREIOT.prototype.Stop = function () {
        stop = true;
        sender = undefined;
        receiver = undefined;
        clearTimeout(tokenRefreshTimer);
    };
    AZUREIOT.prototype.Submit = function (message, node, service) {
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
        message.service = service;
        
       //var msg = new Message(message);
        
        sender.send(node, message, function (err) {
            if (err)
                me.onQueueErrorReceiveCallback(err);
        });
    };
    AZUREIOT.prototype.Track = function (trackingMessage) {
        try {
            var me = this;
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
                    me.onQueueErrorSubmitCallback("Unable to send message. " + err.code + " - " + err.message)
                    console.log("Unable to send message. " + err.code + " - " + err.message);
                    if (storageIsEnabled)
                        storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                }
                else if (res.statusCode >= 200 && res.statusCode < 300) {
                }
                else if (res.statusCode == 401) {
                    console.log("Invalid token. Updating token...")

                    //acquireToken("MICROSERVICEBUS", "TRACKING", restTrackingToken, function (token) {
                    //    if (token == null && storageIsEnabled) {
                    //        me.onQueueErrorSubmitCallback("Unable to aquire tracking token: " + token);
                    //        storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                    //        return;
                    //    }
                        
                    //    restTrackingToken = token;
                    //    me.Track(trackingMessage);
                    //});
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
    AZUREIOT.prototype.Update = function (settings) {
        restTrackingToken = settings.trackingToken;
    };
    function create_sas_token(uri, key_name, key) {
        // Token expires in 24 hours
        var expiry = Math.floor(new Date().getTime() / 1000 + 3600 * 24);
        var string_to_sign = encodeURIComponent(uri) + '\n' + expiry;
        var hmac = crypto.createHmac('sha256', key);
        hmac.update(string_to_sign);
        var signature = hmac.digest('base64');
        var token = 'SharedAccessSignature sr=' + encodeURIComponent(uri) + '&sig=' + encodeURIComponent(signature) + '&se=' + expiry + '&skn=' + key_name;
        return token;
    }
    
    function createSenderFromClientSharedAccessSignature(sharedAccessSignature) {
        var sas = SharedAccessSignature.parse(sharedAccessSignature);
        var uri = decodeURIComponent(sas.sr);
        var parsedUri = url.parse(uri);
        uri = parsedUri.host == null?uri:parsedUri.host;
        
        var uriSegments = uri.split('/');
        var host = uriSegments[0];
        var config = {
            hubName: uri.split('.', 1)[0],
            host: uri,
            keyName: sas.skn,
            sharedAccessSignature: sas.toString()
        };
        
        var DefaultTransport = require('../node_modules/azure-iothub/lib/amqp.js');
        /*Codes_SRS_NODE_DEVICE_CLIENT_16_030: [The fromSharedAccessSignature method shall return a new instance of the Client object] */
        return new iothub.Client(new DefaultTransport(config));
    }
    function createReceiverFromClientSharedAccessSignature(sharedAccessSignature) {
        var sas = SharedAccessSignature.parse(sharedAccessSignature);
        var uri = decodeURIComponent(sas.sr);
        var parsedUri = url.parse(uri);
        uri = parsedUri.host == null?uri:parsedUri.host;
        
        var uriSegments = uri.split('/');
        
        var config = {
            host: uriSegments[0],
            deviceId: uriSegments[uriSegments.length - 1],
            hubName: uriSegments[0].split('.')[0],
            sharedAccessSignature: sharedAccessSignature
        };
        
        return new Client(new AmqpWs(config));
    }
    function createTrackingFromClientSharedAccessSignature(sharedAccessSignature) {
        var sas = SharedAccessSignature.parse(sharedAccessSignature);
        var uri = decodeURIComponent(sas.sr);
        var parsedUri = url.parse(uri);
        uri = parsedUri.host == null?uri:parsedUri.host;
        
        var uriSegments = uri.split('/');
        var host = uriSegments[0];
        var config = {
            hubName: uri.split('.', 1)[0],
            host: uri,
            keyName: sas.skn,
            sharedAccessSignature: sas.toString()
        };
        
        return new Client(new Amqp(config));
    }
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
module.exports = AZUREIOT;