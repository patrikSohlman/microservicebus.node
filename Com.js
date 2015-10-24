
var AMQPClient = require('amqp10').Client;
var Policy = require('amqp10').Policy;

function Com(nodeName, sbSettings) {
    var sbSettings = sbSettings;
    sbSettings.sbNamespace = sbSettings.sbNamespace + '.servicebus.windows.net';
    var uri = 'amqps://' + encodeURIComponent(sbSettings.sasKeyName) + ':' + encodeURIComponent(sbSettings.sasKey) + '@' + sbSettings.sbNamespace;
    var policy = Policy.ServiceBusTopic;
    policy.reconnect.forever = false;
    policy.reconnect.retries = 2;
    
    var trackingClient = new AMQPClient(Policy.EventHub);
    var messageClient = new AMQPClient(policy);
    var messageSender;
    var trackingSender;

    this.onQueueMessageReceivedCallback = null;
    this.onQueueErrorReceiveCallback = null;
    this.onQueueErrorSubmitCallback = null;
    
    Com.prototype.Start = function () {
        messageClient.connect(uri)
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
    };

    Com.prototype.Submit = function (message, node, service) {
        var request = {
            body: message, 
            applicationProperties: {
                node: node,
                service: service
            }
        };
        while (messageSender === undefined) {
            try {
                require('deasync').runLoopOnce();
            }
            catch (errr) {
                console.log("waiting for sender to get ready...");
            }
        }
        console.log("Sender is READY!");
        
        return messageSender.send(request)
                    .then(function (err) {
            
        });
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
        this.Submit(trackingMessage, "tracking");
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
}
module.exports = Com;