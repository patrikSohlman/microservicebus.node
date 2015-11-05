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
    var checkConnectionInterval;
    
    // Azure API App support
    var port = 1833;//process.env.PORT || 1337;
    var baseHost = process.env.WEBSITE_HOSTNAME || 'localhost';
    var http = require('http');
    var express = require('express');
    var swaggerize = require('swaggerize-express');
    var bodyParser = require('body-parser')
    var app = express();
    console.log("Server port:" + port);
    // END Azure API App support
    

    var client = new signalR.client(
        settings.hubUri + '/signalR',
	    ['integrationHub'],                
        10, //optional: retry timeout in seconds (default: 10)
        true
    );
    
    // Wire up signalR status events
    client.serviceHandlers = {
        
        bound: function () { console.log("Connection: " + "bound".yellow); },
        connectFailed: function (error) {
            console.log("Connection: " + "Connect Failed".red);
        },
        connected: function (connection) {
            console.log("Connection: " + "Connected".green);
            signIn();
            checkConnection();
        },
        disconnected: function () {
            console.log("Connection: " + "Disconnected".yellow);
            if (com != null) {
                com.Stop();
            }
        },
        onerror: function (error) { console.log("Connection: " + "Error: ".red, error); },
        messageReceived: function (message) {
            //console.log("Websocket messageReceived: ", message);
            //return false;
        },
        bindingError: function (error) {
            console.log("Connection: " + "Binding Error: ".red, error);
        },
        connectionLost: function (error) {
            console.log("Connection: " + "Connection Lost: ".red);
        },
        reconnected: void function (connection) {
            console.log("Connection: " + "Reconnected ".green);
        },
        reconnecting: function (retry /* { inital: true/false, count: 0} */) {
            console.log("Connection: " + "Retrying: ".yellow, retry);
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
        
        client.invoke('integrationHub', 'pingResponse', settings.nodeName , os.hostname(), "Online", settings.organizationId);
        
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
        
        log(settings.nodeName + ' successfully logged in');
        signInResponse = response;
        
        var sbSettings = {
            sbNamespace : response.sbNamespace,
            topic : response.topic,
            sasKey : response.sasKey,
            sasKeyName : response.sasKeyName,
            trackingKey : response.trackingKey,
            trackingHubName : response.trackingHubName,
            trackingKeyName: response.trackingKeyName,
            protocol : response.protocol.toLowerCase()
        };
        com = new Com(settings.nodeName, sbSettings);
        com.OnQueueMessageReceived(function (sbMessage) {
            var message = sbMessage.body;
            var service = sbMessage.applicationProperties.value.service;
            receiveMessage(message, service);
        });
        com.OnReceivedQueueError(function (message) {
            console.log("OnReceivedError: ".red + message);
        });
        com.OnSubmitQueueError(function (message) {
            console.log("OnSubmitError: ".red + message );
        });
        com.Start();
        
        _itineraries = signInResponse.itineraries;
        loadItineraries(signInResponse.organizationId, signInResponse.itineraries);

        setTimeout(function () { restorePersistedMessages(); }, 3000);
    });
    
    // Called by HUB when node has been successfully created
    client.on('integrationHub', 'nodeCreated', function (nodeData) {
        
        console.log("nodeCreated => Successfully created node: " + nodeData.nodeName.green);
        
        log(settings.nodeName + ' Successfully created node: ' + nodeData.nodeName);
        
        nodeData.machineName = os.hostname();
        
        settings = extend(settings, nodeData);
        
        var data = JSON.stringify(settings);
        
        fs.writeFileSync('./settings.json', data);
        
        
        signIn();
    });
    
    // Signing in the to HUB
    function signIn() {
        
        // Logging in using code
        if (settings.nodeName == null || settings.nodeName.length == 0) { // jshint ignore:line
            if (temporaryVerificationCode.length == 0) { // jshint ignore:line
                console.log('No hostname or temporary verification code has been provided.');
            }
            else {
                client.invoke(
                    'integrationHub', 
    		        'createHost',	
    		        temporaryVerificationCode, 
                    hostPrefix, 
                    existingHostName
                );
            }
        }

    // Logging in using settings
        else {
            
            var hostData = {
                Name : settings.nodeName ,
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
            if (microService == null) { 
                var logm = "The service receiving this message is no longer configured to run on this node. This can happen when a service has been shut down and restarted on a different machine";
                trackException(message, destination, "Failed", "90001", logm);
                log(logm);
                console.log("Error: ".red + logm);
                return;
            }

            message.IsFirstAction = false;
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
                settings.nodeName,
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
    
    // Restore persisted messages from ./persist folder
    function restorePersistedMessages() { 
        fs.readdir('./persist/', function (err, files) {
            if (err) throw err;
            for (var i = 0; i < files.length; i++) {
                var file = './persist/' + files[i];
                var persistMessage = JSON.parse(fs.readFileSync(file, 'utf8'));
                com.Submit(persistMessage.message, persistMessage.node, persistMessage.service);
                try {
                    fs.unlinkSync(file);
                }
                catch (fe) {
                    var msg = "Unable to delete file from persistent store. The message was successfully submitted, but will be submitted again after the node restarts.";
                    log(msg);
                    console.log("Error: ".red + msg.grey)
                }
            }
        });
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
            onStarted(0, 0);
        
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
                    if (host != settings.nodeName)
                        continue;
                    
                    var scriptFile = settings.hubUri + '/api/Scripts/' + itinerary.activities[i].userData.type + '.js';
                    scriptFile = scriptFile.replace('wss://', 'https://');
                    
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
                            //var body = JSON.stringify(httpResponse.body);
                            //var b = JSON.parse(body);
                            var buff = new Buffer(httpResponse.body);
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
                    newMicroService.IntegrationName = itinerary.integrationName;
                    newMicroService.Environment = itinerary.environment;
                    newMicroService.TrackingLevel = itinerary.trackingLevel;
                    newMicroService.App = app;

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
                            integrationMessage.Sender = settings.nodeName;
                            
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
                                        settings.nodeName,
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
                    if (itineraries.length == loadedItineraries) {
                        onStarted(itineraries.length, exceptionsLoadingItineraries);
                        startListen();
                    }
                }
            catch (ex2) {
                    console.log('Unable to start service.'.red);
                    console.log(ex2.message.red);
                }
            }
        };
    }
    
    // Start listener
    function startListen() { 
        app.use(bodyParser.json());
        var server = http.createServer(app);
        app.use(swaggerize({
            api: require('./swagger.json'),
            docspath: '/swagger',
            handlers: './Handlers/'
        }));
        app.use('/', express.static(__dirname + '/html'));
        
        app._router.stack.forEach(function (endpoint) {
            if(endpoint.route != undefined)
                log(endpoint.route.path);
        });

        server.listen(port, 'localhost', function () {
            if (baseHost === 'localhost') {
                app.setHost(baseHost + ':' + port);
            } else {
                app.setHost(baseHost);
            }
            console.log("Server started ..");
        });
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
            Host : settings.nodeName ,
            OrganizationId : settings.organizationId,
            InterchangeId : msg.InterchangeId,
            ItineraryId : msg.ItineraryId,
            IntegrationName : msg.IntegrationName,
            Environment : msg.Environment,
            TrackingLevel : msg.TrackingLevel,
            IntegrationId : msg.IntegrationId,
            IsFault : false,
            FaultCode : msg.FaultCode,
            FaultDescription : msg.FaultDescripton,
            IsFirstAction : msg.IsFirstAction,
            TimeStamp : utcNow,
            State : status,
            Variables : msg.Variables
        };
        com.Track(trackingMessage);

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
            Host : settings.nodeName ,
            Variables : null,
            OrganizationId : settings.organizationId,
            IntegrationName : msg.IntegrationName,
            Environment : msg.Environment,
            TrackingLevel : msg.TrackingLevel,
            InterchangeId : msg.InterchangeId,
            ItineraryId : msg.ItineraryId,
            IntegrationId : msg.IntegrationId,
            FaultCode : msg.FaultCode,
            FaultDescription : msg.FaultDescripton,
            IsFirstAction : msg.IsFirstAction,
            TimeStamp : utcNow,
            IsFault : true,
            State : status,
            FaultCode : fault,
            FaultDescription : faultDescription
        };
        com.Track(trackingMessage);
    };
    
    // Submits the messagee to the hub to show up in the portal console
    function log(message) {
        console.log("Log: " + message.grey);
        client.invoke( 
            'integrationHub',
		    'logMessage',	
		    settings.nodeName,
            message,
            settings.organizationId);
    }
    
    // To enforce the signalR client to recognize disconnected state
    function checkConnection() { 
        checkConnectionInterval = setInterval(function () {
            client.invoke( 
                'integrationHub',
		        'hello');

        }, 5000);
        
    }
    
    // this function is called when you want the server to die gracefully
    // i.e. wait for existing connections
    var gracefulShutdown = function () {
        console.log("Received kill signal, shutting down gracefully.");
        log(settings.nodeName + ' signing out...');
        
        client.end();
        process.exit();
    }
    
    // listen for TERM signal .e.g. kill 
    process.on('SIGTERM', gracefulShutdown);
    
    // listen for INT signal e.g. Ctrl-C
    process.on('SIGINT', gracefulShutdown);
    
    MicroServiceBusHost.prototype.Start = function (testFlag) {
        
        var args = process.argv.slice(2);
        if (settings.hubUri != null && settings.nodeName != null && settings.organizationId != null) { // jshint ignore:line
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
                    console.log('node start.js /c <Verification code> [/h <Host name>]'.yellow);
                    console.log('Eg: node start.js /c V5VUYFSY [/h MyHostName]'.yellow);
                    process.exit();
                }
                
                settings.nodeName = process.argv[3];
                settings.organizationId = process.argv[2];
                settings.machineName = os.hostname();
                
                if (settings.debug == null) // jshint ignore:line
                    settings.debug = false;
                
                if (settings.hubUri == null) // jshint ignore:line
                    settings.debug = "wss://microservicebus.com";
                
                util.saveSettings(settings);
                
                console.log('OrganizationId: ' + settings.organizationId.gray + ' Host: ' + settings.nodeName.gray);
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
        if (settings.nodeName != null && settings.organizationId != null) {
            if (temporaryVerificationCode != null)
                console.log('Settings has already set. Temporary verification code will be ignored.'.gray);
            
            settings.machineName = os.hostname();
            util.saveSettings(settings);
            
            console.log('OrganizationId: ' + settings.organizationId.gray + ' Host: ' + settings.nodeName.gray);
            console.log('Hub: ' + settings.hubUri.gray);
            console.log('');
        }
    };
    MicroServiceBusHost.prototype.Stop = function () {
        _shoutDown = true;
        for (i in _inboundServices) {
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
        catch (ex) { }
    };
    MicroServiceBusHost.prototype.OnStarted = function (callback) {
        onStarted = callback;
    };
}
module.exports = MicroServiceBusHost;