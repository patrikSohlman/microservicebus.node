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

var crypto = require('crypto');
var httpRequest = require('request');
var storage = require('node-persist');
var util = require('../Utils.js');
var storageIsEnabled = true;

function REST(nodeName, sbSettings) {
    
    var baseAddress = "https://" + sbSettings.sbNamespace;
    if (!baseAddress.match(/\/$/)) {
        baseAddress += '/';
    }
    var restMessagingToken = create_sas_token(baseAddress, sbSettings.sasKeyName, sbSettings.sasKey);
    var restTrackingToken = create_sas_token(baseAddress, sbSettings.trackingKeyName, sbSettings.trackingKey);
    
    REST.prototype.Start = function () {
        console.log('*** STARTED ***');
        // Weird, but unless I thorow away a dummy message, the first message is not picked up by the subscription
        this.Submit("{}", nodeName, "--dummy--");
        
        stop = false;
        listenMessaging();
    };
    REST.prototype.Stop = function () {
        stop = true;
    };
    REST.prototype.Submit = function (message, node, service) {
        console.log('*** SUBMIT ***');
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
                }
                else if (res.statusCode == 401) { //else if (res.statusCode == 401 && res.statusMessage == '40103: Invalid authorization token signature') {
                    // Outdated token
                    console.log("Invalid token. Recreating token...")
                    restMessagingToken = create_sas_token(baseAddress, sbSettings.sasKeyName, sbSettings.sasKey);
                    this.Submit(message, node, service)
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
                    restTrackingToken = create_sas_token(baseAddress, sbSettings.trackingKeyName, sbSettings.trackingKey);
                    this.Track(trackingMessage)
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
                else if (res.statusCode == 401) {
                    console.log("Invalid token. Updating token...")
                    restMessagingToken = create_sas_token(baseAddress, sbSettings.sasKeyName, sbSettings.sasKey);
                    listenMessaging();
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
}
module.exports = REST;