/*
The MIT License (MIT)

Copyright (c) 2014 Mikael Håkansson

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
var signalR = require('signalr-client');
var npm = require('npm');
var linq = require('node-linq').LINQ;
var moment = require('moment');
var extend = require('extend');
var reload = require('require-reload')(require);
var guid = require('guid');
var os = require("os");
var https = require('https');
var fs = require('fs');
var path = require('path');
var util = require('./Utils.js');
var color = require('colors');
var syncrequest = require('sync-request');
var MicroService = require('./Services/microService.js');
var Com = require("./Com.js");
var _downloadedScripts = [];

// TEST

//var xml = require('xml');
//var obj = { "Cars": [{ "_attr": { "xmlns": "http://microservicebus.com" } }, { "LicenseNumber": "AAA123", "Brand": "Audi", "Model": "A4", "Color": "Midnight blue", "Class": "Standard" }] };
//xmlString = xml(obj);

//var obj = [
//    {
//        toys: [
//            { _attr: { decade: '80s', locale: 'US' } }, 
//            { toy: 'Transformers', Color: 'Red' } , 
//            { toy: 'GI Joe' , Color: 'Green'}, 
//            { toy: 'He-man' , Color: 'Blue'}]
//    }
//];

//xmlString = xml(obj,true);

function MicroServiceBusHost(settings) {
    // Callbacks
    this.onStarted = null;
    // Handle settings
    var temporaryVerificationCode;
    var existingHostName;
    var hostPrefix = 'nodeJs'; // Used for creating new hosts
    var _itineraries; // all downloaded itineries for this host
    var _inboundServices = []; // all started services
    var _hasDisconnected = false;
    var _shoutDown = false;
    var signInResponse;
    var com;

    
    var client = new signalR.client(
        settings.hubUri + '/signalR',
	    ['integrationHub'],                
        10, //optional: retry timeout in seconds (default: 10)
        true
    );
    
    // Wire up signalR status events
    client.serviceHandlers = {
        
        bound: function () { console.log("Connection: " + "bound".yellow); },
        connectFailed: function (error) { console.log("Connection: " + "Error: ".red, error); },
        connected: function (connection) {
            console.log("Connection: " + "Connected".green);
            signIn();
        },
        disconnected: function () { console.log("Connection: " + "Disconnected".yellow); },
        onerror: function (error) { console.log("Connection: " + "Error: ".red, error); },
        messageReceived: function (message) {
        //console.log("Websocket messageReceived: ", message);
        //return false;
        },
        bindingError: function (error) { console.log("Connection: " + "Binding Error: ".red, error); },
        connectionLost: function (error) { console.log("Connection: " + "Connection Lost: ".red, error); },
        reconnecting: function (retry /* { inital: true/false, count: 0} */) {
            console.log("Connection: " + "Retrying: ".red, retry);
            //return retry.count >= 3; /* cancel retry true */
            return true;
        }
    };
    
    client.on('integrationHub', 'broadcastMessage', function (message) {
        console.log("broadcastMessage => " + message);
    });
    
    // Called by HUB if it was ot able to process the request
    client.on('integrationHub', 'errorMessage', function (message) {
        console.log("errorMessage => " + message);
    });
    
    // Called by HUB when user clicks on the Hosts page
    client.on('integrationHub', 'ping', function (message) {
        console.log("ping => " + _inboundServices.length + " active services");
        
        client.invoke('integrationHub', 'pingResponse', settings.hostName , os.hostname(), "Online", settings.organizationId);
        
    });
    
    // Called by HUB to receive all active serices
    client.on('integrationHub', 'getEndpoints', function (message) {
        console.log("getEndpoints => " + message);
    });
    
    // Called by HUB when itineraries has been updated
    client.on('integrationHub', 'updateItinerary', function (updatedItinerary) {
        console.log("updateItinerary => ");
        
        // Stop all services
        console.log("");
        console.log("|" + util.padLeft("", 20, '-') + "|-----------|" + util.padLeft("", 40, '-') + "|");
        console.log("|" + util.padRight("Inbound service", 20, ' ') + "|  Status   |" + util.padRight("Script file", 40, ' ') + "|");
        console.log("|" + util.padLeft("", 20, '-') + "|-----------|" + util.padLeft("", 40, '-') + "|");
        
        _inboundServices.forEach(function (service) {
            try {
                service.Stop();
                var lineStatus = "|" + util.padRight(service.Name, 20, ' ') + "| " + "Stopped".yellow + "   |" + util.padRight(" ", 40, ' ') + "|";
                console.log(lineStatus);
            }
        catch (ex) {
                console.log('Unable to stop '.red + service.Name.red);
                console.log(ex.message.red);
            }
        });
        _downloadedScripts = [];
        _inboundServices = [];
        
        var itinerary = new linq(_itineraries).First(function (i) { return i.itineraryId === updatedItinerary.itineraryId; });
        
        for (var i = _itineraries.length; i--;) {
            if (_itineraries[i].itineraryId === updatedItinerary.itineraryId) {
                _itineraries.splice(i, 1);
            }
        }
        _itineraries.push(updatedItinerary);
        
        
        loadItineraries(settings.organizationId, _itineraries);
    });
    
    // Incoming message from HUB
    client.on('integrationHub', 'sendMessage', function (message, destination) {
        //receiveMessage(message, destination);
    });
    
    // Called by HUB when signin  has been successful
    client.on('integrationHub', 'signInMessage', function (response) {
        console.log("signInMessage => Successfully logged in");
        
        log(settings.hostName + ' successfully logged in');
        signInResponse = response;
        
        var sbSettings = {
            sbNamespace : response.sbNamespace,
            topic : response.topic,
            sasKey : response.sasKey,
            sasKeyName : response.sasKeyName,
            trackingKey : response.trackingKey,
            trackingHubName : response.trackingHubName,
            trackingKeyName: response.trackingKeyName
        };
        com = new Com(settings.hostName, sbSettings);
        com.OnQueueMessageReceived(function (sbMessage) {
            var message = sbMessage.body;
            var service = sbMessage.applicationProperties.value.service;
            receiveMessage(message, service);
        });
        com.OnReceivedQueueError(function (message) {
            console.log("OnReceivedError");
        });
        com.OnSubmitQueueError(function (message) {
            console.log("OnSubmitError");
        });
        com.Start();

        _itineraries = signInResponse.itineraries;
        loadItineraries(signInResponse.organizationId, signInResponse.itineraries);
    });
    
    // Called by HUB when Host has been successfully created
    client.on('integrationHub', 'hostCreated', function (hostData) {
        
        console.log("hostCreated => Successgully created host: " + hostData.hostName.green);
        
        log(settings.hostName + ' Successgully created host: ' + hostData.hostName);
        
        hostData.MachineName = os.hostname();
        
        settings = extend(settings, hostData);
        
        var data = JSON.stringify(settings);
        
        fs.writeFileSync('./settings.json', data);
        
        
        signIn();
    });
    
    // Signing in the to HUB
    function signIn() {
        
        // Logging in using code
        if (settings.hostName == null || settings.hostName.length == 0) { // jshint ignore:line
            if (temporaryVerificationCode.length == 0) { // jshint ignore:line
                console.log('No hostname or temporary verification code has been provided.');
            }
            else {
                client.invoke(
                    'integrationHub', 
    		        'createHost',	
    		        temporaryVerificationCode, hostPrefix, existingHostName
                );
            }
        }
    // Logging in using settings
        else {
            
            var hostData = {
                Name : settings.hostName ,
                MachineName : settings.MachineName,
                OrganizationID : settings.organizationId
            };
            client.invoke(
                'integrationHub', 
    		    'SignIn',	
    		    hostData
            );
        }
    }
    
    // Incoming messages
    function receiveMessage(message, destination) {
        try {
            var microService = new linq(_inboundServices).First(function (i) {
                return i.Name === destination && 
                        i.ItineraryId == message.ItineraryId;
            });
            
            microService.OnCompleted(function (integrationMessage, destination) {
                trackMessage(integrationMessage, destination, "Completed");
            });
            
            // Track incoming message
            trackMessage(message, destination, "Started");
            var buf = new Buffer(message._messageBuffer, 'base64');
            var messageString = buf.toString('utf8');
            
            // Submit message to service
            if (message.ContentType != 'application/json') {
                microService.Process(messageString, message);
            }
            else {
                var obj = JSON.parse(messageString);
                microService.Process(obj, message);
            }
            
            // Check for correlations
            var correlationValue = microService.CorrelationValue(messageString, message);
            if (correlationValue != null) { // jshint ignore:line
                //Publish correlation
                client.invoke(
                    'integrationHub',
		        'persistCorrelation',	
		        microService.Name, 
                settings.hostName,
                correlationValue,
                message
                );
            }
        }
    catch (err) {
            console.log("Error at: ".red + destination);
            console.log("Error id: ".red + err.name);
            console.log("Error desccription: ".red + err.message);
            trackException(message, destination, "Failed", err.name, err.message);
        }
    
    }
    
    // Called after successfull signin.
    // Iterates through all itineries and download the scripts, afterwhich the services is started
    function loadItineraries(organizationId, itineraries) {
        console.log("");
        console.log("|" + util.padLeft("", 20, '-') + "|-----------|" + util.padLeft("", 40, '-') + "|");
        console.log("|" + util.padRight("Inbound service", 20, ' ') + "|  Status   |" + util.padRight("Script file", 40, ' ') + "|");
        console.log("|" + util.padLeft("", 20, '-') + "|-----------|" + util.padLeft("", 40, '-') + "|");

        var loadedItineraries = 0;
        var exceptionsLoadingItineraries = 0;
        
        if (itineraries.length == 0)
            onStarted(0,0);
        
        //itineraries.forEach(function (itinerary) {
        for (var n in itineraries) {
            itinerary = itineraries[n];
            if (_shoutDown) {
                break;
            }
            var itineraryId = itinerary.itineraryId;
            for (var i in itinerary.activities) {
                if (_shoutDown) {
                    console.log("Shoutdown has been called.".red);
                    break;
                }
                try {
                    var activity = itinerary.activities[i];
                    
                    if (activity.type == 'draw2d.Connection')
                        continue;
                    
                    var host = new linq(activity.userData.config.generalConfig)
                                .First(function (c) { return c.id === 'host'; }).value;
                    
                    var isEnabled = new linq(activity.userData.config.generalConfig)
                                .First(function (c) { return c.id === 'enabled'; }).value;
                    if (host != settings.hostName)
                        continue;
                    
                    var scriptFile;
                    
                    // If the activity is a dynamic nodeJs activity, pick the script from the activity
                    if (itinerary.activities[i].userData.type == "nodeJsBaseOneWayInboundService" ||
                    itinerary.activities[i].userData.type == "nodeJsBaseOneWayOutboundService" ||
                    itinerary.activities[i].userData.type == "nodeJsBaseTwoWayOutboundService") {
                        
                        scriptFile = new linq(activity.userData.config.staticConfig)
                                .First(function (c) { return c.id === 'scriptFile'; }).value;
                    }
                    else { // else: pick the file from the site
                        scriptFile = settings.hubUri + '/api/Scripts/' + itinerary.activities[i].userData.type + '.js';
                        scriptFile = scriptFile.replace('wss://', 'https://');
                    }
                    
                    var integrationId = activity.userData.integrationId;
                    
                    var fileName = path.basename(scriptFile);
                    
                    if (!isEnabled) {
                        var lineStatus = "|" + util.padRight(activity.userData.id, 20, ' ') + "| " + "Disabled".grey + "  |" + util.padRight(fileName, 40, ' ') + "|";
                        console.log(lineStatus); continue;
                    }
                    
                    var exist = new linq(_downloadedScripts).First(function (s) { return s.name === fileName; }); // jshint ignore:line
                    if (exist == null) { // jshint ignore:line
                        // Download the script file
                        try {
                            var httpResponse = syncrequest('GET', scriptFile);
                            if (httpResponse.statusCode != 200)
                                throw 'Resourse not found';
                            var body = JSON.stringify(httpResponse.body);
                            var b = JSON.parse(body);
                            var buff = new Buffer(b.data);
                            var scriptContent = buff.toString('utf8');
                            // Write the script files to disk
                            fs.writeFileSync("./Services/" + fileName, scriptContent);
                            
                            _downloadedScripts.push({ name: fileName });
                        }
                    catch (ex) {
                            //console.log(itinerary.activities[i].userData.type + '.js does not exist. This might be due to the microsevice is not enabled for the nodeJs host yet.');
                            var lineStatus = "|" + util.padRight(activity.userData.id, 20, ' ') + "| " + "Not found".red + " |" + util.padRight(fileName, 40, ' ') + "|";
                            
                            console.log(lineStatus);
                            continue;
                        }
                    
                    }
                    // Load an instance of the base class
                    // Extend the base class with the new class
                    var newMicroService = extend(new MicroService(), reload("./Services/" + fileName));
                    
                    newMicroService.OrganizationId = organizationId;
                    newMicroService.ItineraryId = itineraryId;
                    newMicroService.Name = activity.userData.id;
                    newMicroService.Itinerary = itinerary;
                    newMicroService.IntegrationId = integrationId;
                    newMicroService.Config = activity.userData.config;
                    
                    // Eventhandler for messages sent back from the service
                    newMicroService.OnMessageReceived(function (integrationMessage, sender) {
                        
                        integrationMessage.OrganizationId = settings.organizationId;
                        
                        if (integrationMessage.FaultCode != null) {
                            trackException(integrationMessage, 
                                integrationMessage.LastActivity, 
                                "Failed", 
                                integrationMessage.FaultCode, 
                                integrationMessage.FaultDescripton);

                            console.log('Exception: '.red + integrationMessage.FaultDescripton);
                            return;
                        }
                        
                        // Process the itinerary to find next service
                        var successors = getSuccessors(integrationMessage);
                        
                        successors.forEach(function (successor) {
                            integrationMessage.Sender = settings.hostName;
                            
                            var correlationValue = sender.CorrelationValue(null, integrationMessage);
                            
                            if (integrationMessage.LastActivity == integrationMessage.CreatedBy && correlationValue == null) // jshint ignore:line
                                trackMessage(integrationMessage, integrationMessage.LastActivity, "Started");
                            
                            // Check for correlations
                            if (correlationValue != null) { // jshint ignore:line
                                // Follow correlation. Tracking is done on server side
                                try {
                                    client.invoke(
                                        'integrationHub',
		                                'followCorrelation',	
		                                successor.userData.id, 
                                        settings.hostName,
                                        correlationValue,
                                        settings.organizationId,
                                        integrationMessage);

                                }
                            catch (err) {
                                    console.log(err);
                                }
                            }
                            else {
                                // No correlation
                                try {
                                  //  var invokeResult = client.invoke( 
                                  //      'integrationHub',
		                                //'sendMessage',	
		                                //successor.userData.id, 
                                  //      integrationMessage);

                                    com.Submit(integrationMessage, 
                                        successor.userData.host.toLowerCase(),
                                        successor.userData.id);

                                    trackMessage(integrationMessage, integrationMessage.LastActivity, "Completed");
                                }
                            catch (err) {
                                    console.log(err);
                                }
                            }
                        });

                    });
                    // [DEPRICATED]Eventhandler for any errors sent back from the service
                    newMicroService.OnError(function (source, errorId, errorDescription) {
                        console.log("The Error method is depricated. Please use the ThrowError method instead.".red);
                        console.log("Error at: ".red + source);
                        console.log("Error id: ".red + errorId);
                        console.log("Error desccription: ".red + errorDescription);
                    });
                    // Eventhandler for any debug information sent back from the service
                    newMicroService.OnDebug(function (source, info) {
                        if (settings.debug != null && settings.debug == true) {// jshint ignore:line
                            console.log("DEBUG: ".green + '['.gray + source.gray + ']'.gray + '=>'.green + info);
                            log('DEBUG:[' + source.gray + '] => ' + info);
                        }
                    });
                    
                    // Start the service
                    try {
                        newMicroService.Start();
                        
                        _inboundServices.push(newMicroService);
                        
                        var lineStatus = "|" + util.padRight(newMicroService.Name, 20, ' ') + "| " + "Started".green + "   |" + util.padRight(fileName, 40, ' ') + "|";
                        console.log(lineStatus);

                    }
                    catch (ex) {
                        console.log('Unable to start service '.red + newMicroService.Name.red);
                        if (typeof ex === 'object')
                            console.log(ex.message.red);
                        else
                            console.log(ex.red);

                        exceptionsLoadingItineraries++;
                    }
                    loadedItineraries++;
                    if (itineraries.length == loadedItineraries)
                        onStarted(itineraries.length, exceptionsLoadingItineraries);
                }
            catch (ex2) {
                    console.log('Unable to start service.'.red);
                    console.log(ex2.message.red);
                }
            }
        };
    }
    
    // Returns the next services in line to be executed.
    function getSuccessors(integrationMessage) {
        
        var itinerary = integrationMessage.Itinerary;
        var serviceName = integrationMessage.LastActivity;
        var lastActionId = new linq(itinerary.activities)
                                .First(function (action) { return action.userData.id === serviceName; }).id;
        
        var connections = new linq(itinerary.activities)
                                .Where(function (connection) {
            return connection.type === 'draw2d.Connection' && connection.source.node === lastActionId;
        }).items;
        
        
        var successors = [];
        
        connections.forEach(function (connection) {
            if (connection.source.node == lastActionId) {
                var successor = new linq(itinerary.activities)
                                .First(function (action) { return action.id === connection.target.node; });
                
                if (validateRoutingExpression(successor, integrationMessage)) {
                    var destination = new linq(successor.userData.config.generalConfig)
                                .First(function (c) { return c.id === 'host'; }).value;

                    successor.userData.host = destination;
                    successors.push(successor);
                }
            }
        });
        
        return successors;
    }
    
    // Evaluates the routing expression
    function validateRoutingExpression(actitity, integrationMessage) {
        var expression;
        try {
            var routingExpression = new linq(actitity.userData.config.staticConfig)
                                .First(function (c) { return c.id === 'routingExpression'; });
            if (routingExpression == null) // jshint ignore:line
                return true;
            
            var messageString = '{}';
            if (integrationMessage.ContentType == 'application/json') {
                var buf = new Buffer(integrationMessage._messageBuffer, 'base64');
                messageString = buf.toString('utf8');
            }
            // Add variables
            var varialbesString = '';
            if (integrationMessage.Variables != null) { // jshint ignore:line
                integrationMessage.Variables.forEach(function (variable) {
                    switch (variable.Type) {
                        case 'String':
                        case 'DateTime':
                            varialbesString += 'var ' + variable.Variable + ' = ' + "'" + variable.Value + "';\n";
                            break;
                        case 'Number':
                        case 'Decimal':
                            varialbesString += 'var ' + variable.Variable + ' = ' + variable.Value + ";\n";
                            break;
                        case 'Message':
                            var objString = JSON.stringify(variable.Value);
                            varialbesString += 'var ' + variable.Variable + ' = ' + objString + ";\n";
                            break;
                        default:
                            break;
                    }
                });
            }
            expression = 'message =' + messageString + ';\n' + varialbesString + routingExpression.value;
            
            eval(expression); // jshint ignore:line
            return route;
        }
    catch (ex) {
            console.log("Unable to run script: ".red + expression.gray);
            throw "Unable to run script: " + expression;
        }
    }
    
    // Submits tracking data to host
    function trackMessage(msg, lastActionId, status) {
        
        var time = moment();
        var utcNow = time.utc().format('YYYY-MM-DD HH:mm:ss');
        
        var trackingMessage =
 {
            _message : msg.MessageBuffer,
            ContentType : msg.ContentType,
            LastActivity : lastActionId,
            NextActivity : null,
            Host : settings.hostName ,
            OrganizationId : settings.organizationId,
            InterchangeId : msg.InterchangeId,
            ItineraryId : msg.ItineraryId,
            IntegrationId : msg.IntegrationId,
            FaultCode : msg.FaultCode,
            FaultDescription : msg.FaultDescripton,
            IsFirstAction : msg.IsFirstAction,
            TimeStamp : utcNow,
            State : status,
            Variables : msg.Variables
        };
        com.Track(trackingMessage);
        //var trackingMessages = [];
        //trackingMessages.push(trackingMessage);
        

  //      client.invoke(
  //          'integrationHub',
		//'trackData',	
		//trackingMessages 
  //      );
    }
    
    // Submits exception message for tracking
    function trackException(msg, lastActionId, status, fault, faultDescription) {
        
        var time = moment();
        var utcNow = time.utc().format('YYYY-MM-DD HH:mm:ss');
        
        var trackingMessage =
 {
            _message : msg.MessageBuffer,
            ContentType : msg.ContentType,
            LastActivity : lastActionId,
            NextActivity : null,
            Host : settings.hostName ,
            Variables : null,
            OrganizationId : settings.organizationId,
            IntegrationId : guid.EMPTY,
            InterchangeId : msg.InterchangeId,
            ItineraryId : msg.ItineraryId,
            IntegrationId : msg.IntegrationId,
            FaultCode : msg.FaultCode,
            FaultDescription : msg.FaultDescripton,
            IsFirstAction : msg.IsFirstAction,
            TimeStamp : utcNow,
            State : status,
            FaultCode : fault,
            FaultDescription : faultDescription
        };
        com.Track(trackingMessage);
  //      var trackingMessages = [];
  //      trackingMessages.push(trackingMessage);
        
  //      client.invoke(
  //          'integrationHub',
		//'trackData',	
		//trackingMessages 
  //      );
    };
    
    function log(message) {
        client.invoke( 
            'integrationHub',
		'logMessage',	
		settings.hostName,
        message,
        settings.organizationId);
    }
    
    // this function is called when you want the server to die gracefully
    // i.e. wait for existing connections
    var gracefulShutdown = function () {
        console.log("Received kill signal, shutting down gracefully.");
        log(settings.hostName + ' signing out...');
        
        client.end();
        process.exit();
    }
    
    // listen for TERM signal .e.g. kill 
    process.on('SIGTERM', gracefulShutdown);
    
    // listen for INT signal e.g. Ctrl-C
    process.on('SIGINT', gracefulShutdown);
    
    //process.on('uncaughtException', function (err) {
    //    console.log('Uncaught exception: '.red + err);
    //});
    
    MicroServiceBusHost.prototype.Start = function (testFlag) {
        
        var args = process.argv.slice(2);
        if (settings.hubUri != null && settings.hostName != null && settings.organizationId != null) { // jshint ignore:line
            console.log('Logging in using settings'.grey);
        }
        else if (args.length > 0) { // Starting using code
            switch (args[0]) {
                case '/c':
                case '-c':
                case '-code':
                case '/code':
                    temporaryVerificationCode = args[1];
                    
                    if (args[2] != null && args[3] != null && // jshint ignore:line
                        (args[2] == '/h' || 
                        args[2] == '-h' ||
                        args[2] == '/host' ||
                        args[2] == '-host'))
                        existingHostName = args[3];
                    
                    break;
                default: {
                    console.log('Sorry, invalid arguments.'.red);
                    console.log('To start the host using temporary verification code, use the /code paramenter.'.yellow);
                    console.log('Eg: microServiceBus.js -code ABCD1234'.yellow);
                    console.log('');
                    console.log('You may also host name:'.yellow);
                    console.log('Eg: microServiceBus.js -code ABCD1234 -host nodejs00001'.yellow);
                    console.log('');
                    
                    process.abort();
                }
            }
        }
        else {// Wrong config
            if (temporaryVerificationCode != null) { // jshint ignore:line
    
            }
            else {
                if (process.argv.length != 4) {
                    console.log('');
                    console.log('Missing arguments'.red);
                    console.log('Make sure to start using arguments; verification code (/c) and optionally host name.'.yellow);
                    console.log(' If you leave out the host name, a new host will be generated for you'.yellow);
                    console.log('Eg: node microservicebus.js /c <Verification code> [/h <Host name>]'.yellow);
                    console.log('Eg: node microservicebus.js /c V5VUYFSY [/h MyHostName]'.yellow);
                    process.exit();
                }
                
                settings.hostName = process.argv[3];
                settings.organizationId = process.argv[2];
                settings.machineName = os.hostname();
                
                if (settings.debug == null) // jshint ignore:line
                    settings.debug = false;
                
                if (settings.hubUri == null) // jshint ignore:line
                    settings.debug = "wss://microservicebus.com";
                
                util.saveSettings(settings);
                
                console.log('OrganizationId: ' + settings.organizationId.gray + ' Host: ' + settings.hostName.gray);
                console.log('Hub: ' + settings.hubUri.gray);
                console.log('');
            }
        }
        
        if (typeof String.prototype.startsWith != 'function') {
            // see below for better implementation!
            String.prototype.startsWith = function (str) {
                return this.indexOf(str) === 0;
            };
        }
        // Only used for localhost
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        

        if (testFlag != true) {
            process.on('uncaughtException', function (err) {
                console.log('Uncaught exception: '.red + err);
            });
        }
        client.start();
        
        // Startig using proper config
        if (settings.hostName != null && settings.organizationId != null) {
            if (temporaryVerificationCode != null)
                console.log('Settings has already set. Temporary verification code will be ignored.'.gray);
            
            settings.machineName = os.hostname();
            util.saveSettings(settings);
            
            console.log('OrganizationId: ' + settings.organizationId.gray + ' Host: ' + settings.hostName.gray);
            console.log('');
        }
    };
    MicroServiceBusHost.prototype.Stop = function () {
        _shoutDown = true;
        for(i in _inboundServices){
            // _inboundServices.forEach(function (service) {
            var service = _inboundServices[i];
            try {
                service.Stop();
                var lineStatus = "|" + util.padRight(service.Name, 20, ' ') + "| " + "Stopped".yellow + "   |" + util.padRight(" ", 40, ' ') + "|";
                console.log(lineStatus);
                delete service;
            }
            catch (ex) {
                console.log('Unable to stop '.red + service.Name.red);
                console.log(ex.message.red);
            }
        };
        _downloadedScripts = null;
        _inboundServices = null;
        _itineraries = null;
        _inboundServices = null;
        try {
            client.serviceHandlers = null;
            client.end();
            delete client;
        } 
        catch (ex){}
    };
    MicroServiceBusHost.prototype.OnStarted = function (callback) {
        onStarted = callback;
    };
}
module.exports = MicroServiceBusHost;