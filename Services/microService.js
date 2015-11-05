
var extend = require('extend');
var guid = require('guid');
var npm = require('npm');
var linq = require('node-linq').LINQ;
var fs = require('graceful-fs');
var path = require("path");

function MicroService(microService) {
    // Initialize all instance properties
    this.microService = microService;
    
    this.Name = "Not set";
    this.OrganizationId = "Not set";
    this.IntegrationId = "Not set";
    this.IntegrationName = "Not set";
    this.Environment = "Not set";
    this.ItineraryId = "Not set";
    this.Itinerary = "Not set";
    this.Config = "Not set";
    this.IsEnabled = "Not set";
    this.App = null; // Used for Azure API Apps
    
    this.RunInboundScript = "Not set";
    this.RunOutboundScript = "Not set";
    this.RunScript = "Not set";
    this.ValidateRoutingExpression = "Not set";
    
    // Callbacks
    this.onMessageReceivedCallback = null;
    this.onCompletedCallback = null;
    this.onErrorCallback = null;
    this.onDebugCallback = null;
    this.onThrowErrorCallback = null;
    
    MicroService.prototype.Start = function () {
        console.log("microserviceBus::Started - NOT IMPLEMENTED!");
    };
    
    MicroService.prototype.Stop = function () {
        console.log("microserviceBus::Started - NOT IMPLEMENTED!");
    };
    
    MicroService.prototype.Process = function (message, context) {
        console.log("microserviceBus::Process - NOT IMPLEMENTED!");
    };
    
    
    // Callback for messages going back to the host 
    MicroService.prototype.OnMessageReceived = function (callback) {
        onMessageReceivedCallback = callback;
    };
    // Callback indicating the outbound message has been processed.
    MicroService.prototype.OnCompleted = function (callback) {
        onCompletedCallback = callback;
    };
    // [Depricated] Callback for errors 
    MicroService.prototype.OnError = function (callback) {
        onErrorCallback = callback;
    };
    // Callback for debug information
    MicroService.prototype.OnDebug = function (callback) {
        onDebugCallback = callback;
    };
    // Submits message back to the host 
    MicroService.prototype.SubmitMessage = function (payload, contentType, varaiables) {
        
        var messageBuffer;
        var isBinary = false;
        switch (contentType) {
            case 'application/json':
                if (typeof payload == 'object')
                    payload = JSON.stringify(payload);
                
                messageBuffer = new Buffer(payload).toString('base64');
                break;
            case 'application/xml':
            case 'text/plain':
                messageBuffer = new Buffer(payload).toString('base64');
            default:
                isBinary = true;
                var base64string = payload.toString('base64');
                messageBuffer = new Buffer(base64string).toString('base64');
                break;
        }
        
        var integrationMessage = this.CreateMessage(messageBuffer, contentType, varaiables, isBinary);
        onMessageReceivedCallback(integrationMessage, this);
    };
    // Submits reponse message back to host
    MicroService.prototype.SubmitResponseMessage = function (payload, context, contentType) {
        
        var isBinary = false;
        var messageBuffer;
        switch (contentType) {
            case 'application/json':
                payload = JSON.stringify(payload);
                messageBuffer = new Buffer(payload).toString('base64');
                break;
            case 'application/xml':
            case 'text/plain':
                messageBuffer = new Buffer(payload).toString('base64');
                break;
            default:
                messageBuffer = payload;
                isBinary = true;
                break;
        }
        
        var integrationMessage = {
            InterchangeId : context.InterchangeId,
            IntegrationId : context.IntegrationId,
            ItineraryId : context.ItineraryId,
            CreatedBy : context.CreatedBy,
            LastActivity : this.Name,
            ContentType : contentType,
            Itinerary : context.Itinerary,
            MessageBuffer : messageBuffer,
            _messageBuffer : messageBuffer,
            IsBinary : isBinary,
            IsLargeMessage : false,
            IsCorrelation : false,
            IsFirstAction : false,
            Variables : context.Variables
        };
        
        onMessageReceivedCallback(integrationMessage, this);
    };
    // Call indicating the outbound message has been processed.
    MicroService.prototype.Done = function (integrationMessage, destination) {
        onCompletedCallback(integrationMessage, destination);
    };
    
    MicroService.prototype.CorrelationValue = function (messageString, message) {
        var correlationNode = new linq(this.Config.generalConfig).First(function (c) { return c.id === 'correlationId'; });
        if (correlationNode != null && 
            correlationNode.value != null && 
            correlationNode.value != '' && message.ContentType == 'application/json') {
            
            var correlationValue = correlationNode.value;
            
            if (messageString == null) {
                var buf = new Buffer(message._messageBuffer, 'base64');
                messageString = buf.toString('utf8');
            }

            if (correlationNode.value.startsWith('{') || correlationNode.value.startsWith('[')) {
                correlationValue = this.ParseString(correlationNode.value, messageString, message);
            }
            
            this.Debug('Correlation value set (' + correlationValue + ')');

            return correlationValue;
        }
        else { 
            return null;
        }
    };

    MicroService.prototype.Error = function (source, errorId, errorDescription) {
        onErrorCallback(source, errorId, errorDescription);
    };
    
    MicroService.prototype.ThrowError = function (originalMessage, errorId, errorDescription) {
        if (originalMessage == null) { // Inbound service
            var messageBuffer = new Buffer('').toString('base64');
            originalMessage = this.CreateMessage(messageBuffer, 'text/plain', [], false);
            originalMessage.IsFirstAction = true;
        }
        originalMessage.FaultCode = errorId;
        originalMessage.FaultDescripton = errorDescription;
        onMessageReceivedCallback(originalMessage, this);
    };

    MicroService.prototype.Debug = function (info) {
        onDebugCallback(this.Name, info);
    };
    
    MicroService.prototype.AddNpmPackage = function (npmPackages, logOutput, callback) {
        var ret;
        var me = this;
        npm.load({loaded: true}, function (err) {
            // catch errors
            var packages = npmPackages.split(',');

            for (var i = 0; i < packages.length; i++) {
                var npmPackage = packages[i];
                var packageFolder = path.resolve(npm.dir, npmPackage)
                fs.stat(packageFolder, function (er, s) {
                    if (er || !s.isDirectory()) {
                        npm.commands.install([npmPackage], function (er, data) {
                            ret = er;
                        });
                        npm.on("log", function (message) {
                            if (logOutput)
                                me.Debug(message);
                        });
                    }
                    else {
                        if (logOutput)
                            me.Debug(npmPackage + ' is already installed');
                        ret = null;
                    }
                });
            }
        });
        while (ret === undefined) {
            try {
                require('deasync').runLoopOnce();
            }
            catch (errr) { 
                console.log();
            }
        }
        callback(ret);
    };
    
    MicroService.prototype.ParseString = function (str, payload, context) {
        
        // Parse with context '{}'
        var match;
        
        var pattern = /\{(.*?)\}/g;
        
        while ((match = pattern.exec(str)) != null) {
            var variable = new linq(context.Variables).First(function (v) { return v.Variable === match[1]; });
            if (variable != null) { 
                str = str.replace('{' + match[1] + '}', variable.Value);
            }
        }
        
        if (context.ContentType == 'application/json' && typeof payload != "object") { 
            payload = JSON.parse(payload);
        }
        // Parse with payload '[]'
        pattern = /\[(.*?)\]/g;
        
        while ((match = pattern.exec(str)) != null) {
           str = str.replace('[' + match[1] + ']', payload[match[1]]);
        }
        return str;
    };

    // Internal
    MicroService.prototype.CreateMessage = function (messageBuffer, contentType, varaiables, isBinary) {
        
        // clone itinerary
        var json = JSON.stringify(this.Itinerary);
        var itinerary = JSON.parse(json);
        
        
        if (varaiables != null && itinerary.variables != null)
            variables = itinerary.variables.concat(varaiables);
       
        var integrationMessage = {
            InterchangeId : guid.raw(),
            IntegrationId : this.IntegrationId,
            IntegrationName : this.IntegrationName,
            Environment : this.Environment,
            TrackingLevel : this.TrackingLevel,
            ItineraryId : this.ItineraryId,
            CreatedBy : this.Name,
            LastActivity : this.Name,
            ContentType : contentType,
            Itinerary : itinerary,
            MessageBuffer : messageBuffer,
            _messageBuffer : messageBuffer,
            IsBinary : isBinary,
            IsLargeMessage : false,
            IsCorrelation : false,
            IsFirstAction : true,
            Variables : varaiables
        };
        
        return integrationMessage;
    };
    
    MicroService.prototype.GetPropertyValue = function (category, prop) {
        var cat;
        switch (category) {
            case 'general':
                cat = this.Config.generalConfig;
                break;
            case 'static':
                cat = this.Config.staticConfig;
                break;
            case 'security':
                cat = this.Config.securityConfig;
                break;
            case 'dynamic':
                cat = this.Config.dynamicConfig;
                break;
            default:
                throw 'Unsuported category';
        }
        var property = new linq(cat).First(function (c) { return c.id === prop; });
        return property.value;
    }
}

module.exports = MicroService;