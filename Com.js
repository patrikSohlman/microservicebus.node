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
var AMQPClient = require('amqp10').Client;
var Policy = require('amqp10').Policy;
var crypto = require('crypto');
var httpRequest = require('request');
var storage = require('node-persist');
var util = require('./Utils.js');
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
    
    if (sbSettings.protocol == "amqp") {
        var trackingClientUri = 'amqps://' + encodeURIComponent(sbSettings.trackingKeyName) + ':' + encodeURIComponent(sbSettings.trackingKey) + '@' + sbSettings.sbNamespace;
        var messageClientUri = 'amqps://' + encodeURIComponent(sbSettings.sasKeyName) + ':' + encodeURIComponent(sbSettings.sasKey) + '@' + sbSettings.sbNamespace;
        
        var trackingClientPolicy = Policy.ServiceBusQueue;
        trackingClientPolicy.reconnect.forever = false;
        trackingClientPolicy.reconnect.retries = 2;
        
        var messageClientPolicy = Policy.ServiceBusTopic;
        messageClientPolicy.reconnect.forever = false;
        messageClientPolicy.reconnect.retries = 2;
        
        var trackingClient = new AMQPClient(trackingClientPolicy);
        var messageClient = new AMQPClient(messageClientPolicy);
        
        var messageSender;
        var trackingSender;
    }
    else if (sbSettings.protocol == "rest") {
        var listenReq;
        var listenReqInit = false;
        
        var baseAddress = "https://" + sbSettings.sbNamespace;
        if (!baseAddress.match(/\/$/)) {
            baseAddress += '/';
        }
        var restMessagingToken = create_sas_token(baseAddress, sbSettings.sasKeyName, sbSettings.sasKey);
        var restTrackingToken = create_sas_token(baseAddress, sbSettings.trackingKeyName, sbSettings.trackingKey);
    }
    this.onQueueMessageReceivedCallback = null;
    this.onQueueErrorReceiveCallback = null;
    this.onQueueErrorSubmitCallback = null;
    this.onQueueDebugCallback = null;
    
    Com.prototype.Start = function () {
        stop = false;
        if (sbSettings.protocol == "amqp")
            startAMQP();
        else if (sbSettings.protocol == "rest") {
            startREST();
        }
    };
    Com.prototype.Stop = function () {
        stop = true;
        if (sbSettings.protocol == "amqp")
            stopAMQP();
        else if (sbSettings.protocol == "rest") {
            stopREST();
        }
    };
    Com.prototype.Submit = function (message, node, service) {
        if (sbSettings.protocol == "amqp")
            submitAMQP(message, node, service);
        else if (sbSettings.protocol == "rest") {
            submitREST(message, node, service);
        }

    };
    Com.prototype.SubmitCorrelation = function (message, correlationValue, lastActivity) {
        var request = {
            body: message, 
            applicationProperties: {
                node: "correlation",
                lastActivity: lastActivity,
                correlationValue: correlationValue,
                fromNode: nodeName
            }
        };
        
        if (sender == null) {
            return messageClient.connect(uri)
              .then(function () { return messageClient.createSender(sbSettings.topic); })
              .then(function (s) { sender = s; return sender.send(request); })
              .then(function (err) {
                onSubmitErrorCallback(err)
            });
        }
        else {
            return sender.send(request)
                    .then(function (err) {
                onSubmitErrorCallback(err)
            });
        }
    };
    Com.prototype.Track = function (trackingMessage) {
        if (sbSettings.protocol == "amqp")
            trackAMQP(trackingMessage);
        else if (sbSettings.protocol == "rest") {
            trackREST(trackingMessage);
        }
    };
    
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
    
    // AMQP
    function startAMQP() {
        messageClient.connect(messageClientUri)
        .then(function () {
            return Promise.all([
                messageClient.createSender(sbSettings.topic),
                messageClient.createReceiver(sbSettings.topic + '/Subscriptions/' + nodeName.toLowerCase())
            ]);
        })
        .spread(function (sender, receiver) {
            messageSender = sender;
            sender.on('errorReceived', function (tx_err) {
                onQueueErrorSubmitCallback(tx_err)
            });
            receiver.on('errorReceived', function (rx_err) {
                onQueueErrorReceiveCallback(rx_err);
            });
            
            // message event handler
            receiver.on('message', function (message) {
                onQueueMessageReceivedCallback(message);
            });
        })
        .catch(function (e) {
            console.warn('Error send/receive: ', e);
        });
        
        trackingClient.connect(trackingClientUri)
          .then(function () { return trackingClient.createSender(sbSettings.trackingHubName); })
          .then(function (sender) {
            trackingSender = sender;
            sender.on('errorReceived', function (err) { console.warn(err); });
        })
          .then(function (state) { })
          .catch(function (e) {
            console.warn('Error send/receive: ', e);
        });
    }
    function stopAMQP() { }
    function submitAMQP(message, node, service) {
        while (messageSender === undefined) {
            try {
                require('deasync').runLoopOnce();
            }
            catch (errr) {
                console.log("waiting for sender to get ready...");
            }
        }
        var request = {
            body: message, 
            applicationProperties: {
                node: node,
                service: service
            }
        };
        
        return messageSender.send(request)
                    .then(function (err) {
            
        });
    };
    function trackAMQP(trackingMessage) {
        while (trackingSender === undefined) {
            try {
                require('deasync').runLoopOnce();
            }
            catch (errr) {
                console.log("waiting for trackingSender to get ready...");
            }
        }
        var request = {
            body: trackingMessage, 
            applicationProperties: {}
        };
        return trackingSender.send(request)
                    .then(function (err) {
            
        });
    };
    
    // REST
    function startREST() {
        // Weird, but unless I thorow away a dummy message, the first message is not picked up by the subscription
        submitREST("{}", nodeName, "--dummy--"); 
        
        stop = false;
        listenMessaging();
    }
    function stopREST() {
        stop = true;
    }
    function submitREST(message, node, service) {
        try {
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
                    onQueueErrorSubmitCallback("Unable to send message")
                    console.log("Unable to send message. ");
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
                    onQueueDebugCallback("Submitted message to " + node.toLowerCase() + ". status code:" + res.statusCode);
                    //process.exit();
                }
                else if (res.statusCode == 401 && res.statusMessage == '40103: Invalid authorization token signature') {
                    console.log("Invalid token. Recreating token...")
                    restMessagingToken = create_sas_token(baseAddress, sbSettings.sasKeyName, sbSettings.sasKey);
                    submitREST(message, node, service)
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
            console.log("from submitREST");
        }
    };
    function trackREST_(trackingMessage) {
        try {
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
                        storage.setItem(message.InterchangeId, message);
                }
                else if (res.statusCode >= 200 && res.statusCode < 300) {
                }
                else if (res.statusCode == 401 && res.statusMessage == '40103: Invalid authorization token signature') {
                    console.log("Invalid token. Recreating token...")
                    restTrackingToken = create_sas_token(baseAddress, sbSettings.trackingKeyName, sbSettings.trackingKey);
                    trackREST(trackingMessage)
                    return;
                }
                else {
                    console.log("Unable to send message. " + res.statusCode + " - " + res.statusMessage);
                    if (storageIsEnabled)
                        storage.setItem(message.instanceId, message);
                }
            });

        }
        catch (err) {
            console.log();
        }
    };
    function trackREST(trackingMessage) {
        try {
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
                        storage.setItem(message.InterchangeId, message);
                }
                else if (res.statusCode >= 200 && res.statusCode < 300) {
                }
                else if (res.statusCode == 401 && res.statusMessage == '40103: Invalid authorization token signature') {
                    console.log("Invalid token. Recreating token...")
                    restTrackingToken = create_sas_token(baseAddress, sbSettings.trackingKeyName, sbSettings.trackingKey);
                    trackREST(trackingMessage)
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
    function listenMessaging() {
        try {
            if (stop) {
                onQueueDebugCallback("Queue listener is stopped");
             
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
                    onQueueErrorReceiveCallback("Unable to receive message. " + err.code + " - " + err.message)
                    console.log("Unable to receive message. " + err.code + " - " + err.message);
                }
                else if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        if (res.statusCode == 204) {
                            listenMessaging();
                            return;
                        }
                        var service = res.headers.service.replace(/"/g, '');
                        if (service != "--dummy--") {
                            
                            var message = JSON.parse(res.body);
                            var responseData = {
                                body : message,
                                applicationProperties: { value: { service: service } }
                            }
                            onQueueMessageReceivedCallback(responseData);
                        }
                    }
                    catch (listenerror) {
                        console.log("Unable to parse incoming message. " + listenerror.code + " - " + listenerror.message);
                    }
                }
                else if (res.statusCode == 401 && res.statusMessage == '40103: Invalid authorization token signature') {
                    console.log("Invalid token. Recreating token...")
                    restMessagingToken = create_sas_token(baseAddress, sbSettings.sasKeyName, sbSettings.sasKey);
                    return;
                }
                else {
                    console.log("Unable to send message. " + res.statusCode + " - " + res.statusMessage);
                }
                listenMessaging();
            });

        }
        catch (err) {
            console.log(err);
        }
    }
    
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
    function initListenRequest() {
        if (!listenReqInit) {
            listenReqInit = true;
            listenReq.on('requestTimeout', function (req) {
                console.log('request has expired');
                //listenReq.abort();
                listenMessaging();
            });
            
            listenReq.on('responseTimeout', function (res) {
                console.log('response has expired');
    
            });
        }
    }
}
module.exports = Com;