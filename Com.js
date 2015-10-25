
var AMQPClient = require('amqp10').Client;
var Policy = require('amqp10').Policy;
var zlib = require('zlib');
var crypto = require('crypto');
var RESTClient = require('node-rest-client').Client;
function Com(nodeName, sbSettings) {
    var sbSettings = sbSettings;
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
       
        var restClient = new RESTClient();

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
    
    Com.prototype.Start = function () {
        if (sbSettings.protocol == "amqp")
            startAMQP();
        else if (sbSettings.protocol == "rest") {
            startREST();
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
        });
        
        trackingClient.connect(trackingClientUri)
          .then(function () { return trackingClient.createSender(sbSettings.trackingHubName); })
          .then(function (sender) {
            trackingSender = sender;
            sender.on('errorReceived', function (err) { console.warn(err); });
        })
          .then(function (state) { });
    }
    function submitAMQP (message, node, service) {       
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
        listenMessaging();
    }
    function submitREST(message, node, service) {
        try {
            var args = {
                data: message,
                headers: {
                    "Authorization": restMessagingToken, 
                    "Content-Type" : "application/json",
                    "node": node,
                    "service" : service
                }
            };
            var submitUri = baseAddress + sbSettings.topic + "/messages" + "?timeout=60"
            restClient.post(submitUri, args, function (data, response) {
                
                // Check if token is valid...
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    console.log("Message sent");
                }
                else if (response.statusCode == 401 && response.statusMessage == '40103: Invalid authorization token signature') {
                    console.log("Invalid token. Recreating token...")
                    token = create_sas_token(baseAddress, sbSettings.sasKeyName, sbSettings.sasKey);
                    sendMessage(baseAddress, topicName, token, message, to);
                    return;
                }
                else {
                    console.log("Unable to send message. " + response.statusCode + " - " + response.statusMessage)
                }
       
            });
        }
        catch (err) {
            console.log();
        }
    };
    function trackREST(trackingMessage) {
        try {
            var args = {
                data: trackingMessage,
                headers: {
                    "Authorization": restTrackingToken, 
                    "Content-Type" : "application/json",
                }
            };
            var trackUri = baseAddress + sbSettings.trackingHubName + "/messages" + "?timeout=60";
            restClient.post(trackUri, args, function (data, response) {
                
                // Check if token is valid...
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    console.log("Tracking Message sent");
                }
                else if (response.statusCode == 401 && response.statusMessage == '40103: Invalid authorization token signature') {
                    console.log("Invalid token. Recreating token...")
                    token = create_sas_token(baseAddress, sbSettings.sasKeyName, sbSettings.sasKey);
                    sendMessage(baseAddress, topicName, token, message, to);
                    return;
                }
                else {
                    console.log("Unable to send message. " + response.statusCode + " - " + response.statusMessage)
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
    function listenMessaging() { 
        try {
            var args = {
                headers: { "Authorization": restMessagingToken },
                requestConfig: {
                    timeout: 50 //response timeout 
                },
                responseConfig: {
                    timeout: 50 //response timeout 
                }
            };
            var listenUri = baseAddress + sbSettings.topic + "/Subscriptions/" + nodeName + "/messages/head" + "?timeout=60"
            listenReq = restClient.delete(listenUri, args, function (data, response) {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    //var message = sbMessage.body;
                    //var service = sbMessage.applicationProperties.value.service;
                    var responseData = {
                        body : data,
                        applicationProperties: {value: {service: response.headers.service.replace(/"/g, '')}}
                    }
                    onQueueMessageReceivedCallback(responseData);
                }
                else { 
                    buf = new Buffer(data, 'base64');
                    rerr = buf.toString('utf8');
                    onQueueErrorReceiveCallback(rerr);
                }
                listenMessaging();
            });
            initListenRequest();
        }
        catch (err) {
            console.log(err);
        }
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