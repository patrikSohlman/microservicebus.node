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
var extend = require('extend');
var guid = require('uuid');
var npm = require('npm');
var linq = require('node-linq').LINQ;
var fs = require('graceful-fs');
var path = require("path");
var util = require('../Utils.js')

function MicroService(microService) {

    this.Name = "Not set";
    this.OrganizationId = "Not set";
    this.IntegrationId = "Not set";
    this.IntegrationName = "Not set";
    this.Environment = "Not set";
    this.ItineraryId = "Not set";
    this.Itinerary = "Not set";
    this.Config = { "general": {}, "static": {}, "security": {} };
    this.IsEnabled = "Not set";
    this.UseEncryption = false;
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
                
                messageBuffer = new Buffer(payload);//.toString('base64');
                break;
            case 'application/xml':
            case 'text/plain':
                messageBuffer = new Buffer(payload);//.toString('base64');
            default:
                isBinary = true;
                var base64string = payload.toString('base64');
                messageBuffer = new Buffer(base64string);//.toString('base64');
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
                messageBuffer = new Buffer(payload);//.toString('base64');
                break;
            case 'application/xml':
            case 'text/plain':
                messageBuffer = new Buffer(payload);//.toString('base64');
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
    /* istanbul ignore next */
    MicroService.prototype.CorrelationValue = function (messageString, message) {
        var correlationNode = this.Config.general.correlationId;// new linq(this.Config.generalConfig).First(function (c) { return c.id === 'correlationId'; });
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
    /* istanbul ignore next */
    MicroService.prototype.Error = function (source, errorId, errorDescription) {
        onErrorCallback(source, errorId, errorDescription);
    };
    
    MicroService.prototype.ThrowError = function (originalMessage, errorId, errorDescription) {
        if (originalMessage == null) { // Inbound service
            var messageBuffer = new Buffer('').toString('base64');
            originalMessage = this.CreateMessage(messageBuffer, 'text/plain', [], false);
            originalMessage.IsFirstAction = true;
        }
        originalMessage.LastActivity = this.Name;
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
            // All packages
            var packages = npmPackages.split(',');
            var newPackages = [];

            for (var i = 0; i < packages.length; i++) {
                var npmPackage = packages[i];
                var packageFolder = path.resolve(npm.dir, npmPackage)
                try {
                    var stats = fs.lstatSync(packageFolder);
                    if (!stats.isDirectory()) {
                        newPackages.push(npmPackage);
                    }
                }
                catch(e) {
                    newPackages.push(npmPackage);
                }
            }
            
            if (newPackages.length == 0)
                callback(null);
            else {
                npm.commands.install(newPackages, function (er, data) {
                    callback(er);
                });
                npm.on("log", function (message) {
                    ret = null;
                });
            }
        });
    };
    
    MicroService.prototype.ParseString = function (str, payload, context) {
        // Parse with context '{}'
        var match;
        var regstr = str;
        var pattern = /\{(.*?)\}/g;
        
        while ((match = pattern.exec(str)) != null) {
            var variable = new linq(context.Variables).First(function (v) { return v.Variable === match[1]; });
            if (variable != null) {
                regstr = regstr.replace('{' + match[1] + '}', variable.Value);
               // return str;
            }
        }
        
        if (context.ContentType != 'application/json') {
            return str;
        }
        
        if (context.ContentType == 'application/json' && typeof payload == "object") {
            payload = JSON.stringify(payload);
        }

        // Parse with payload '[]'
        pattern = /\[(.*?)\]/g;
        
        while ((match = pattern.exec(regstr)) != null) {
            
            var expression = "message = " + payload + ";\nvar str = message." + match[1] + ";";
            eval(expression);
            regstr = regstr.replace('['+ match[1]+']', str);

            //return str;
        }
        return regstr;
    };

    // Internal
    MicroService.prototype.CreateMessage = function (messageBuffer, contentType, variables, isBinary) {
        
        // clone itinerary
        var json = JSON.stringify(this.Itinerary);
        var itinerary = JSON.parse(json);
                
        if (variables != null && itinerary.variables != null)
            variables = itinerary.variables.concat(variables);
        
        itinerary.variables = variables;

        var integrationMessage = {
            InterchangeId : guid.v1(),
            IntegrationId : this.IntegrationId,
            IntegrationName : this.IntegrationName,
            Environment : this.Environment,
            TrackingLevel : this.TrackingLevel,
            ItineraryId : this.ItineraryId,
            CreatedBy : this.Name,
            LastActivity : this.Name,
            ContentType : contentType,
            Itinerary : itinerary,
            MessageBuffer : messageBuffer.toString('base64'),
            _messageBuffer : messageBuffer.toString('base64'),
            IsBinary : isBinary,
            IsLargeMessage : false,
            IsCorrelation : false,
            IsFirstAction : true,
            Variables : variables
        };
        
        return integrationMessage;
    };
    /* istanbul ignore next */
    MicroService.prototype.GetPropertyValue_OLD = function (category, prop) {
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
            default:
                throw 'Unsuported category';
        }
        try {
            var property = new linq(cat).First(function (c) { return c.id === prop; });
        }
        catch (e) { 
            throw "Property " + prop + " of category " + category + " not found in service setup configuration.";
        }
        if (property == undefined)
            throw "Property " + prop + " of category " + category + " not found in service setup configuration.";

        return property.value;
    }
    
    MicroService.prototype.GetPropertyValue = function (category, prop) {
        try {
            switch (category) {
                case 'general':
                    return this.Config.general[prop];
                case 'static':
                    return this.Config.static[prop];
                case 'security':
                    return this.Config.security[prop];
                default:
                    throw 'Unsuported category';
            }
        }
        catch (e) {
            throw "Property " + prop + " of category " + category + " not found in service setup configuration.";
        }
    }
    // Build up the configuration object
    MicroService.prototype.Init = function (config) {
        
        // General
        for (var i = 0; i < config.generalConfig.length; i++) {
            var name = config.generalConfig[i].id;
            var val = config.generalConfig[i].value;
            if (typeof val == "string" && val.startsWith("env:")) {
                this.Config.general[name] = process.env[val.substring(4)];
            }
            else {
                this.Config.general[name] = val;
            }
        };
        
        // Static
        for (var i = 0; i < config.staticConfig.length; i++) {
            var name = config.staticConfig[i].id;
            var val = config.staticConfig[i].value;
            if (typeof val == "string" && val.startsWith("env:")) {
                this.Config.static[name] = process.env[val.substring(4)];
            }
            else {
                this.Config.static[name] = val;
            }
        };

        // Security
        for (var i = 0; i < config.securityConfig.length; i++) {
            var name = config.securityConfig[i].id;
            var val = config.securityConfig[i].value;
            if (typeof val == "string" && val.startsWith("env:")) {
                this.Config.security[name] = process.env[val.substring(4)];
            }
            else {
                this.Config.security[name] = val;
            }
        };
        
    }
    
    extend(this, microService);
}

module.exports = MicroService;