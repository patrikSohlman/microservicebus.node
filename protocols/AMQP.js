/*
The MIT License (MIT)

Copyright (c) 2014 microServiceBus.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without AMQPriction, including without limitation the rights
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
var crypto = require('crypto');
var storage = require('node-persist');
var util = require('../Utils.js');
var storageIsEnabled = true;

function AMQP(nodeName, sbSettings) {
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
    
    AMQP.prototype.Start = function (done) {
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
                onQueueErrorReceiveCallback("Unable to receive message. " + tx_err);
            });
            receiver.on('errorReceived', function (rx_err) {
                onQueueErrorReceiveCallback("Unable to receive message. " + rx_err);
            });
            
            // message event handler
            receiver.on('message', function (message) {
                onQueueMessageReceivedCallback(message);
            });
        })
        .catch(function (e) {
            onQueueErrorReceiveCallback("Unable to start AMQP client. " + e);
        });
        
        trackingClient.connect(trackingClientUri)
          .then(function () { return trackingClient.createSender(sbSettings.trackingHubName); })
          .then(function (sender) {
            trackingSender = sender;
            sender.on('errorReceived', function (err) {
                onQueueErrorReceiveCallback("Unable to start tracking client (AMQP) " + err);
            });
        })
          .then(function (state) {
            console.log(state);
        })
          .catch(function (e) {
            onQueueErrorReceiveCallback("Unable to start tracking client (AMQP) " + e);
        });
    };
    AMQP.prototype.Stop = function () {
        messageSender.disconnect(function () {
            onQueueDebugCallback("Stopped message client");
        });
        trackingClient.disconnect(function () {
            onQueueDebugCallback("Stopped tracking client");
        });
    };
    AMQP.prototype.Submit = function (message, node, service) {
        if (messageSender == undefined) {
            return;
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
            if (err) {
                onQueueErrorReceiveCallback("Unable to send message " + err);
            }
        });
    };
    AMQP.prototype.Track = function (trackingMessage) {
        if (trackingClient == undefined) {
            return;
        }
        
        var request = {
            body: trackingMessage, 
            applicationProperties: {}
        };
        return trackingSender.send(request)
                    .then(function (err) {
            if (err) {
                onQueueErrorReceiveCallback("Unable to send tracking message " + err);
            }
        });
    };
}
module.exports = AMQP;