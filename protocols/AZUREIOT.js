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
    
    // Setup tracking
    var baseAddress = "https://" + sbSettings.sbNamespace;
    if (!baseAddress.match(/\/$/)) {
        baseAddress += '/';
    }
    var restTrackingToken2 = create_sas_token(baseAddress, sbSettings.trackingKeyName, sbSettings.trackingKey);
    var restTrackingToken = sbSettings.trackingToken;
    
    var a = decodeURIComponent(restTrackingToken2);
    var b = decodeURIComponent(restTrackingToken);

    AZUREIOT.prototype.Start = function () {
        console.log("Start Called");
        stop = false;
        
        sender = createSenderFromClientSharedAccessSignature(sbSettings.senderToken);
        receiver = createReceiverFromClientSharedAccessSignature(sbSettings.receiverToken);
        
        //tracker.open(function (err) {
        //    if (err) {
        //        onQueueErrorReceiveCallback('Unable to connect to Azure IoT Hub (send) : ' + err);
        //    }
        //    else {
        //        onQueueDebugCallback("Tracking is ready");
        //        tracker.on('error', function (msg) {
        //            console.log("receive error message...");
        //        });
        //    }
        //});
        sender.open(function (err) {
            if (err) {
                onQueueErrorReceiveCallback('Unable to connect to Azure IoT Hub (send) : ' + err);
            }
            else {
                onQueueDebugCallback("Sender is ready");
                receiver.open(connectCallback);
            }
        });
    };
    AZUREIOT.prototype.Stop = function () {
        stop = true;
        sender = undefined;
        receiver = undefined;

    };
    AZUREIOT.prototype.Submit = function (message, node, service) {
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
        
        var msg = new Message(message);
        
        sender.send(node, msg, function (err) {
            if (err)
                onQueueErrorReceiveCallback(err);
        });
    };
    AZUREIOT.prototype.Track = function (trackingMessage) {
        
        try {
            if (stop) {
                if (storageIsEnabled)
                    storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                
                return;
            }
            //try {
            //    var message = new Message(trackingMessage);
            //    tracker.sendEvent(message, function (err) {
            //        console.log("sendEvent callback!")
            //        if (err)
            //            onQueueErrorReceiveCallback(err);
            //    });
            //}
            //catch (e) { 
            //    console.log('')
            //}
            //return;
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
                    onQueueErrorSubmitCallback("Unable to send message. " + err.code + " - " + err.message)
                    console.log("Unable to send message. " + err.code + " - " + err.message);
                    if (storageIsEnabled)
                        storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                }
                else if (res.statusCode >= 200 && res.statusCode < 300) {
                }
                else if (res.statusCode == 401) {
                    console.log("Invalid token. Updating token...")
                    ///
                    me.Track(trackingMessage)
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

    var connectCallback = function (err) {
        if (err) {
            onQueueErrorReceiveCallback('Could not connect: ' + err.message);
        } else {
            onQueueDebugCallback("Receiver is ready");
            receiver.on('message', function (msg) {
                try {
                    //console.log("receive message...");
                    var message = msg.data;
                    
                    var responseData = {
                        body : message,
                        applicationProperties: { value: { service: message.service } }
                    }
                    onQueueMessageReceivedCallback(responseData);
                    
                    receiver.complete(msg, function () {
                        
                    });
                }
                catch (e) {
                    onQueueErrorReceiveCallback('Could not connect: ' + e.message);
                }
            });
        }
    };

}
module.exports = AZUREIOT;