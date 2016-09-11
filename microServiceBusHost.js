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
var color = require('colors');
var signalR = require('signalr-client');
//var linq = require('node-linq').LINQ;
var moment = require('moment');
var extend = require('extend');
var async = require('async');
var reload = require('require-reload')(require);
var os = require("os");
var fs = require('fs');
var path = require('path');
var util = require('./Utils.js');
var MicroService = require('./services/microService.js');
var Com = require("./Com.js");
var http;
var express;
var swaggerize;
var bodyParser;
var guid = require('uuid');
var pjson = require('./package.json');
var keypress = require('keypress');
var Applicationinsights = require("./Applicationinsights.js");
var memwatch; 

function MicroServiceBusHost(settings) {
    var self = this;
    // Callbacks
    this.onStarted = null;
    this.onStopped = null;
    this.onUpdatedItineraryComplete = null;
    // Handle settings
    var temporaryVerificationCode;
    var existingHostName;
    var hostPrefix = 'nodeJs'; // Used for creating new hosts
    var _itineraries; // all downloaded itineries for this host
    var _inboundServices = []; // all started services
    var _hasDisconnected = false;
    var _shoutDown = false;
    var _downloadedScripts = [];
    var _firstStart = true;
    var _loadingState = "none"; // node -> loading -> done -> stopped
    var _restoreTimeout;
    var _comSettings;
    //var _isWaitingForSignInResponse = false;
    var signInResponse;
    var com;
    var checkConnectionInterval;
    var loadedItineraries = 0;
    var exceptionsLoadingItineraries = 0;
    var _startWebServer = false;
    var port = process.env.PORT || 1337;
    var baseHost = process.env.WEBSITE_HOSTNAME || 'localhost';
    var app;// = express();
    var server;
    var rootFolder = process.arch == 'mipsel' ? '/mnt/sda1':'.';
    var applicationinsights = new Applicationinsights();
    var _heartBeatInterval;
    
    var client = new signalR.client(
        settings.hubUri + '/signalR',
	    ['integrationHub'],                
        10, //optional: retry timeout in seconds (default: 10)
        true
    );
    
    // Wire up signalR events
    /* istanbul ignore next */
    client.serviceHandlers = {
        bound: function () { console.log("Connection: " + "bound".yellow); },
        connectFailed: function (error) {
            console.log("Connection: " + "Connect Failed".red);
        },
        connected: function (connection) {
            console.log("Connection: " + "Connected".green);
            signIn();
            startHeartBeat();
        },
        disconnected: function () {
            
            console.log("Connection: " + "Disconnected".yellow);
            if (com != null) {
                com.Stop();
            }

            clearTimeout(_restoreTimeout);
            //stopAllServices(function () {
            //    console.log("All services stopped".yellow);
            //});
        },
        onerror: function (error) {
            console.log("Connection: " + "Error: ".red, error);
            try {
                if (error.endsWith("does not exist for the organization"))
                    self.onStarted(0, 1);
            }
            catch (e) { }
        },
        messageReceived: function (message) {

        },
        bindingError: function (error) {
            console.log("Connection: " + "Binding Error: ".red, error);
        },
        connectionLost: function (error) {
            //_isWaitingForSignInResponse = false;
            console.log("Connection: " + "Connection Lost".red);
        },
        reconnected: void function (connection) {
            console.log("Connection: " + "Reconnected ".green);
        },
        reconnecting: function (retry /* { inital: true/false, count: 0} */) {
            console.log("Connection: " + "Retrying to connect ".yellow);
            return true;
        }
    };
    
    // Wire up signalR inbound events handlers
    client.on('integrationHub', 'errorMessage', function (message) {
        OnErrorMessage(message);
    });
    client.on('integrationHub', 'ping', function (message) {
        OnPing(message);
    });
    client.on('integrationHub', 'getEndpoints', function (message) {
        OnGetEndpoints(message);
    });
    client.on('integrationHub', 'updateItinerary', function (updatedItinerary) {
        OnUpdateItinerary(updatedItinerary);
    });
    client.on('integrationHub', 'changeState', function (state) {
        OnChangeState(state);
    });
    client.on('integrationHub', 'changeDebug', function (debug) {
        OnChangeDebug(debug);
    });
    client.on('integrationHub', 'sendMessage', function (message, destination) {
        OnSendMessage(message, destination)
    });
    client.on('integrationHub', 'signInMessage', function (response) {
        OnSignInMessage(response);
    });
    client.on('integrationHub', 'nodeCreated', function (nodeData) {
        OnNodeCreated(nodeData);
    });
    client.on('integrationHub', 'heartBeat', function (id) {
        //console.log("received heartbeat".gray);
    });    
    // Called by HUB if it was ot able to process the request
    function OnErrorMessage(message) {
        console.log("errorMessage => " + message);
        self.onStarted(0, 1);
    };
    // Called by HUB when user clicks on the Hosts page
    function OnPing(message) {
        
        console.log("ping => " + _inboundServices.length + " active services");
        
        client.invoke('integrationHub', 'pingResponse', settings.nodeName , os.hostname(), "Online", settings.organizationId);
        
    }
    // Called by HUB to receive all active serices
    function OnGetEndpoints(message) {
        console.log("getEndpoints => " + message);
    }
    // Called by HUB when itineraries has been updated
    function OnUpdateItinerary(updatedItinerary) {
        console.log("updateItinerary => ");
        
        // Stop all services
        stopAllServices(function () {
            console.log("All services stopped".yellow);
        });
        
        
        var itinerary = _itineraries.find(function (i) {
            return i.itineraryId === updatedItinerary.itineraryId;
        });
        //var itinerary = new linq(_itineraries).First(function (i) { return i.itineraryId === updatedItinerary.itineraryId; });
        
        for (var i = _itineraries.length; i--;) {
            if (_itineraries[i].itineraryId === updatedItinerary.itineraryId) {
                _itineraries.splice(i, 1);
            }
        }
        _itineraries.push(updatedItinerary);
        
        //loadItineraries(settings.organizationId, _itineraries);
        startAllServices(_itineraries, function () { 
            _restoreTimeout = setTimeout(function () {
                restorePersistedMessages();
            }, 3000);
        });
    }
    // Called by HUB when itineraries has been updated
    function OnChangeState(state) {
        console.log();
        //_isWaitingForSignInResponse = false;
        settings.state = state;
        if (state == "Active")
            console.log("State changed to " + state.green);
        else
            console.log("State changed to " + state.yellow);
        
        if (state != "Active") {
            stopAllServices(function () {
                console.log("All services stopped".yellow);
            });
        }
        else {
            _downloadedScripts = [];
            _inboundServices = [];
            //loadItineraries(settings.organizationId, _itineraries);
            startAllServices(_itineraries, function () { 
        
            });
        }
    } 
    // Update debug mode
    function OnChangeDebug(debug) {
        console.log("Debug state changed to ".grey + debug);
        settings.debug = debug;
        
    }
    // Incoming message from HUB
    function OnSendMessage(message, destination) {
        //receiveMessage(message, destination);
    }
    // Called by HUB when signin  has been successful
    function OnSignInMessage(response) {
        //_isWaitingForSignInResponse = false;

        if (settings.debug != null && settings.debug == true) {// jshint ignore:line
            console.log(settings.nodeName.gray + ' successfully logged in'.green);
        }
        
        signInResponse = response;
        settings.state = response.state;
        settings.debug = response.debug;
        settings.port = response.port == null ? 80 : response.port;
        _comSettings = response;

        if (settings.state == "Active")
            console.log("State: " + settings.state.green);
        else
            console.log("State: " + settings.state.yellow);
        
        _itineraries = signInResponse.itineraries;

        applicationinsights.init(response.instrumentationKey, settings.nodeName)
            .then(function (resp) {
                if (resp)
                    console.log("Application Insights:" + " Successfully initiated".green);
                else
                    console.log("Application Insights:" + " Disabled".grey);
            }, function (error) {
                console.log("Application Insights:" + " Failed to initiate!".green);
            });

        if (_firstStart) {
            _firstStart = false;
            
            console.log("Protocol: " + response.protocol.green)
            com = new Com(settings.nodeName, response, settings.hubUri);
            
            com.OnQueueMessageReceived(function (sbMessage) {
                var message = sbMessage.body;
                var service = sbMessage.applicationProperties.value.service;
                receiveMessage(message, service);
            });
            com.OnReceivedQueueError(function (message) {
                console.log("OnReceivedError: ".red + message);
            });
            com.OnSubmitQueueError(function (message) {
                console.log("OnSubmitError: ".red + message);
            });
            com.OnQueueDebugCallback(function (message) {
                if (settings.debug != null && settings.debug == true) {// jshint ignore:line
                    console.log("COM: ".green + message);
                }
            });
            
            if (settings.enableKeyPress != false) {
                keypress(process.stdin);
                
                // listen for the "keypress" event
                process.stdin.on('keypress', function (ch, key) {
                    if (key.ctrl && key.name == 'c') {
                        gracefulShutdown();
                    }
                    else if (key.name == 'p') {
                        OnPing();
                    }
                    else if (key.name == 'i') {
                        console.log("Active services: ".green + _inboundServices.length);
                    }
                    else if (key.name == 'd') {
                        try {
                            var heapdump = require('heapdump');
                            heapdump.writeSnapshot(function (err, filename) {
                                console.log('Dump written to'.yellow, filename.yellow);
                            });
                        }
                catch (e) {
                            console.log(e);
                        }
                    }
                });
                process.stdin.setRawMode(true);
                process.stdin.resume();
            }
            else {
                port = process.env.PORT || 1337;
            }
        }
        else { 
            com.Update(response);
        }
        startAllServices(_itineraries, function () {
            client.invoke('integrationHub', 'pingResponse', settings.nodeName , os.hostname(), "Online", settings.organizationId);

            _restoreTimeout = setTimeout(function () {
                restorePersistedMessages();
            }, 3000);
        });
        
        
    }
    // Called by HUB when node has been successfully created    
    /* istanbul ignore next */
    function OnNodeCreated(nodeData) {
        
        nodeData.machineName = os.hostname();
        
        settings = extend(settings, nodeData);
        
        log(' Successfully created node: ' + nodeData.nodeName);
        
        var data = JSON.stringify(settings);
        
        fs.writeFileSync(rootFolder + '/settings.json', data);
        
        signIn();
    }
    
    // Signing in the to HUB
    function signIn() {
        
        // Logging in using code
        if (settings.nodeName == null || settings.nodeName.length == 0) { // jshint ignore:line
            if (temporaryVerificationCode != undefined && temporaryVerificationCode.length == 0) { // jshint ignore:line
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
                machineName : settings.machineName,
                OrganizationID : settings.organizationId,
                npmVersion : pjson.version
            };

            client.invoke(
                'integrationHub', 
    		    'SignIn',	
    		    hostData
            );

            if (settings.debug != null && settings.debug == true) {// jshint ignore:line
                console.log("Waiting for signin response".grey);
            }
        }
    }

    // Check heartbeat from the server every 5 min
    // To enforce the signalR client to recognize disconnected state
    function startHeartBeat() {

        if (_heartBeatInterval === null || _heartBeatInterval === undefined) {
            _heartBeatInterval = setInterval(function () {
                var lastHeartBeatId = guid.v1();
                //console.log("sending heartbeat".gray);
                client.invoke(
                    'integrationHub',
                    'heartBeat',
                    lastHeartBeatId
                );
            }, 5*60*1000);
        }
    }

    // Starting up all services
    function startAllServices(itineraries, callback) {
        stopAllServices(function () {
            loadItineraries(settings.organizationId, itineraries, function () { 
                callback();
            });
        });
    }

    // Stopping all services
    function stopAllServices(callback) {
        if (com != null) {
            com.Stop();
        }
        if (_startWebServer) {
            console.log("Server:      " + "Shutting down web server".yellow);
            server.close();
            app = null;
            app = express();
        }
        
        if (_inboundServices.length > 0) {
            console.log("|" + util.padLeft("", 20, '-') + "|-----------|" + util.padLeft("", 40, '-') + "|");
            console.log("|" + util.padRight("Inbound service", 20, ' ') + "|  Status   |" + util.padRight("Flow", 40, ' ') + "|");
            console.log("|" + util.padLeft("", 20, '-') + "|-----------|" + util.padLeft("", 40, '-') + "|");
            
            for (var i = 0; i < _inboundServices.length; i++) {
                var service = _inboundServices[i];
                try {
                    service.Stop();
                    var lineStatus = "|" + util.padRight(service.Name, 20, ' ') + "| " + "Stopped".yellow + "   |" + util.padRight(service.IntegrationName, 40, ' ') + "|";
                    console.log(lineStatus);
                    service = undefined;
                    //delete service;
                }
                catch (ex) {
                    console.log('Unable to stop '.red + service.Name.red);
                    console.log(ex.message.red);
                }
            }
            
            if (server != undefined && server != null)
                server.close();
            
            _startWebServer = false;
            _downloadedScripts = undefined;
            //delete _downloadedScripts;
            _inboundServices = undefined;
            //delete _inboundServices;
            
            _downloadedScripts = [];
            _inboundServices = [];
        }
        callback();
    }
    
    // Incoming messages
    function receiveMessage(message, destination) {
        try {
            var microService = _inboundServices.find(function (i) {
                return i.Name === destination && 
                        i.ItineraryId == message.ItineraryId;
            });
            /* istanbul ignore if */
            if (microService == null) {
                
                // isDynamicRoute means the node of the service was set to dynamic.
                // A dynamicly configured node setting whould mean the node was never initilized
                // and not part of the _inboundServices array.
                // Therefor it need to be initilized and started.
                if (message.isDynamicRoute) {
                    
                    // Find the activity
                    var activity = message.Itinerary.activities.find(function (c) { return c.userData.id === destination; });
                    
                    // Create a startServiceAsync request
                    var intineratyActivity = {
                        activity : activity,
                        itinerary : message.Itinerary
                    };
                    
                    // Call startServiceAsync to initilized and start the service.
                    startServiceAsync(intineratyActivity, settings.organizationId, true, function () {
                        console.log("");
                        console.log("|" + util.padLeft("", 20, '-') + "|-----------|" + util.padLeft("", 40, '-') + "|");
                        console.log("|" + util.padRight("Inbound service", 20, ' ') + "|  Status   |" + util.padRight("Flow", 40, ' ') + "|");
                        console.log("|" + util.padLeft("", 20, '-') + "|-----------|" + util.padLeft("", 40, '-') + "|");
                        
                        microService = _inboundServices[_inboundServices.length - 1];
                        var lineStatus = "|" + util.padRight(microService.Name, 20, ' ') + "| " + "Started".green + "   |" + util.padRight(microService.IntegrationName, 40, ' ') + "|";
                        console.log(lineStatus);
                        
                        console.log();
                        
                        // Set the isDynamicRoute to false and call this method again.
                        microService.Start();
                        message.isDynamicRoute = false;
                        receiveMessage(message, destination)
                    });
                    return;
                }
                else {
                    var logm = "The service receiving this message is no longer configured to run on this node. This can happen when a service has been shut down and restarted on a different machine";
                    trackException(message, destination, "Failed", "90001", logm);
                    log(logm);
                    console.log("Error: ".red + logm);
                    return;
                }
            }
            
            message.IsFirstAction = false;
            microService.OnCompleted(function (integrationMessage, destination) {
                trackMessage(integrationMessage, destination, "Completed");
            });
            
            // Track incoming message
            trackMessage(message, destination, "Started");
            
            var buf = new Buffer(message._messageBuffer, 'base64');
            
            // Encrypted?
            if (message.Encrypted) { 
                buf = util.decrypt(buf);
            }

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
            console.log("Error description: ".red + err.message);
            trackException(message, destination, "Failed", err.name, err.message);
        }
    }
    
    // Restore persisted messages from ./persist folder
    function restorePersistedMessages() {
        fs.readdir(rootFolder + '/persist/', function (err, files) {
            if (err) throw err;
            for (var i = 0; i < files.length; i++) {
                var file = rootFolder + '/persist/' + files[i];
                try {
                    
                    var persistMessage = JSON.parse(fs.readFileSync(file, 'utf8'));
                    
                    if (files[i].startsWith("_tracking_")) {
                        com.Track(persistMessage);
                    }
                    else {
                        com.Submit(persistMessage.message, persistMessage.node, persistMessage.service);
                    }
                }
                catch (se) {
                    var msg = "Unable to read persisted message: " + files[i];
                    console.log("Error: ".red + msg.grey)
                    try {
                        fs.unlinkSync(file);
                    }
                    catch (fex) { }
                }

                try {
                    fs.unlinkSync(file);
                }
                catch (fe) {
                    var msg = "Unable to delete file from persistent store. The message was successfully submitted, but will be submitted again after the node restarts.";
                    console.log("Error: ".red + msg.grey)
                }
            }
        });
    }
    
    // Called after successfull signin.
    // Iterates through all itineries and download the scripts, afterwhich the services is started
    function loadItineraries(organizationId, itineraries, callback) {
        // Prevent double loading
        if (_loadingState == "loading") {
            return;
        }
        
        if (itineraries.length == 0)
            self.onStarted(0, 0);
        
        async.map(itineraries,
            function (itinerary, callback) {
                var itineraryId = itinerary.itineraryId;
                // encapsulate each activity to work in async
                var intineratyActivities = [];
                for (var i = 0; i < itinerary.activities.length; i++) {
                    if (itinerary.activities[i].userData.config != undefined) {
                        var host = itinerary.activities[i].userData.config.generalConfig.find(function (c) { return c.id === 'host'; }).value;
                        if (host == settings.nodeName) {
                            intineratyActivities.push({ itinerary: itinerary, activity: itinerary.activities[i] });
                        }
                    }
                }
                async.map(intineratyActivities, function (intineratyActivity, callback) {
                    startServiceAsync(intineratyActivity, organizationId, false, function () {
                        callback(null, null);
                    });

                }, function (err, results) {
                    callback(null, null);
                });

            },
            function (err, results) {
                // Start com to receive messages
                if (settings.state === 'Active') {
                    com.Start(function () {
                        console.log("");
                        console.log("|" + util.padLeft("", 20, '-') + "|-----------|" + util.padLeft("", 40, '-') + "|");
                        console.log("|" + util.padRight("Inbound service", 20, ' ') + "|  Status   |" + util.padRight("Flow", 40, ' ') + "|");
                        console.log("|" + util.padLeft("", 20, '-') + "|-----------|" + util.padLeft("", 40, '-') + "|");

                        for (var i = 0; i < _inboundServices.length; i++) {
                            var newMicroService = _inboundServices[i];
                        
                            var serviceStatus = "Started".green;
                        
                            if (settings.state == "Active")
                                newMicroService.Start();
                            else
                                serviceStatus = "Stopped".yellow;
                        
                            var lineStatus = "|" + util.padRight(newMicroService.Name, 20, ' ') + "| " + serviceStatus + "   |" + util.padRight(newMicroService.IntegrationName, 40, ' ') + "|";
                            console.log(lineStatus);
                        }
                        console.log();
                        self.onStarted(itineraries.length, exceptionsLoadingItineraries);
                    
                        if (self.onUpdatedItineraryComplete != null)
                            self.onUpdatedItineraryComplete();
                    
                        startListen();
                    
                        _loadingState = "done";
                        callback();    
                    });
                }
        });
    }
    
    // Preforms the following tasks
    // 1. Checks if the service is enabled and continues to set the name of the script 
    // 2. Downloads the script
    // 3. Creatig the service and extends it from MicroService, and registring the events
    // 4. Starts the service
    function startServiceAsync(intineratyActivity, organizationId, forceStart, done) {
        try {
            var activity = intineratyActivity.activity;
            var itinerary = intineratyActivity.itinerary;
            if (activity.type == 'draw2d.Connection') {
                done();
                return;
            }
            
            async.waterfall([
                // Init
                function (callback) {
                    try {
                        var host = activity.userData.config.generalConfig.find(function (c) { return c.id === 'host'; }).value;
                        
                        var isEnabled = activity.userData.config.generalConfig.find(function (c) { return c.id === 'enabled'; }).value;
                        
                        var hosts = host.split(',');
                        var a = hosts.indexOf(settings.nodeName);
                        
                        if (hosts.indexOf(settings.nodeName) < 0 && !forceStart) {
                            done();
                            return;
                        }
                        
                        var scriptFileUri = activity.userData.isCustom == true?
                                        settings.hubUri + '/api/Scripts/' + settings.organizationId + "/" + activity.userData.type + '.js':
                                        settings.hubUri + '/api/Scripts/' + activity.userData.type + '.js';
                        scriptFileUri = scriptFileUri.replace('wss://', 'https://');
                        
                        var integrationId = activity.userData.integrationId;
                        
                        var scriptfileName = path.basename(scriptFileUri);
                        
                        if (!isEnabled) {
                            var lineStatus = "|" + util.padRight(activity.userData.id, 20, ' ') + "| " + "Disabled".grey + "  |" + util.padRight(scriptfileName, 40, ' ') + "|";
                            console.log(lineStatus);
                            done();
                            return;
                        }
                        var exist = _downloadedScripts.find(function (s) { return s.name === scriptfileName; }); // jshint ignore:line    
                        
                        callback(null, exist, scriptFileUri, scriptfileName, integrationId);
                    }
                    catch (error1) {
                        log(error1.message);
                        done();
                    }
                },
                // Download
                function (exist, scriptFileUri, scriptfileName, integrationId, callback) {
                    try {
                        //if (exist != null) {
                        if (false) {
                            callback(null, scriptfileName, integrationId, scriptfileName);
                            return;
                        }
                        else {
                            require("request")(scriptFileUri, function (err, response, scriptContent) {
                                if (response.statusCode != 200 || err != null) {
                                    console.log("Unable to get file:" + fileName);
                                    var lineStatus = "|" + util.padRight(activity.userData.id, 20, ' ') + "| " + "Not found".red + " |" + util.padRight(scriptfileName, 40, ' ') + "|";
                                    console.log(lineStatus);
                                    done();
                                }
                                else {
                                    var localFilePath = __dirname + "/services/" + scriptfileName;
                                    fs.writeFileSync(localFilePath, scriptContent);
                                    _downloadedScripts.push({ name: scriptfileName });
                                    callback(null, localFilePath, integrationId, scriptfileName);
                                }
                            });
                        }
                    }
                    catch (error2) {
                        log(error2.message);
                        done();
                    }
                },
                // CreateService
                function (localFilePath, integrationId, scriptfileName, callback) {
                    try {
                        if (localFilePath == null) {
                            callback(null, null);
                        }
                        // Load an instance of the base class
                        // Extend the base class with the new class
                        //var newMicroService = extend(new MicroService(), reload(localFilePath));
                                
                        var newMicroService = new MicroService(reload(localFilePath));

                        newMicroService.OrganizationId = organizationId;
                        newMicroService.ItineraryId = itinerary.itineraryId;
                        newMicroService.Name = activity.userData.id;
                        newMicroService.Itinerary = itinerary;
                        newMicroService.IntegrationId = activity.userData.integrationId;
                        newMicroService.IntegrationName = itinerary.integrationName;
                        newMicroService.Environment = itinerary.environment;
                        newMicroService.TrackingLevel = itinerary.trackingLevel;
                        newMicroService.Init(activity.userData.config);
                        newMicroService.UseEncryption = settings.useEncryption;
                        newMicroService.ComSettings = _comSettings;
                        
                        // Eventhandler for messages sent back from the service
                        newMicroService.OnMessageReceived(function (integrationMessage, sender) {
                            try {
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
                                
                                trackMessage(integrationMessage, integrationMessage.LastActivity, integrationMessage.IsFirstAction?"Started":"Completed");
                                
                                // Process the itinerary to find next service
                                var successors = getSuccessors(integrationMessage);
                                
                                successors.forEach(function (successor) {
                                    integrationMessage.Sender = settings.nodeName;
                                    
                                    var correlationValue = sender.CorrelationValue(null, integrationMessage);
                                    
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
                                            var messageString = '';
                                            if (integrationMessage.ContentType != 'application/json') {
                                                var buf = new Buffer(integrationMessage._messageBuffer, 'base64');
                                                messageString = buf.toString('utf8');
                                            }
                                            
                                            var destination = sender.ParseString(successor.userData.host, messageString, integrationMessage);
                                            integrationMessage.isDynamicRoute = destination != successor.userData.host;
                                            destination.split(',').forEach(function (destinationNode) {
                                                
                                                // Encrypt?
                                                if (settings.useEncryption == true) {
                                                    var messageBuffer = new Buffer(integrationMessage._messageBuffer, 'base64');
                                                    messageBuffer = util.encrypt(messageBuffer);
                                                    integrationMessage.Encrypted = true;
                                                    integrationMessage._messageBuffer = messageBuffer;
                                                   // integrationMessage.MessageBuffer = messageBuffer;
                                                }
                                                
                                                if (destinationNode == settings.nodeName)
                                                    receiveMessage(integrationMessage, successor.userData.id);
                                                else {
                                                    if (typeof integrationMessage._messageBuffer != "string") {
                                                        integrationMessage._messageBuffer = integrationMessage._messageBuffer.toString('base64');
                                                        //integrationMessage.MessageBuffer = integrationMessage._messageBuffer;
                                                    }
                                                    com.Submit(integrationMessage, 
                                                        destinationNode.toLowerCase(),
                                                        successor.userData.id);
                                                }
                                            });

                                        }
                                    catch (err) {
                                            console.log(err);
                                        }
                                    }
                                });
                            }
                            catch (generalEx) {
                                log(generalEx.message);
                            }
                        });
                        // [DEPRICATED]Eventhandler for any errors sent back from the service
                        newMicroService.OnError(function (source, errorId, errorDescription) {
                            console.log("The Error method is deprecated. Please use the ThrowError method instead.".red);
                            console.log("Error at: ".red + source);
                            console.log("Error id: ".red + errorId);
                            console.log("Error description: ".red + errorDescription);
                        });
                        // Eventhandler for any debug information sent back from the service
                        newMicroService.OnDebug(function (source, info) {
                            if (settings.debug != null && settings.debug == true) {// jshint ignore:line
                                console.log("DEBUG: ".green + '['.gray + source.gray + ']'.gray + '=>'.green + info);
                                applicationinsights.trackEvent("Tracking", { service: source, state: info });
                            }
                        });
                        
                        callback(null, newMicroService, scriptfileName);
                    }
                    catch (error3) {
                        if (newMicroService === undefined) {
                            console.log('Unable to load '.red + localFilePath.red + ' ' + error3);
                        }
                        else
                            console.log('Unable to start service '.red + newMicroService.Name.red + ' ' + error3);

                        done();
                    }
                },
                // StartService
                function (newMicroService, scriptfileName, callback) {
                    if (newMicroService == null) {
                        callback(null, null);
                    }
                    // Start the service
                    try {
                        _inboundServices.push(newMicroService);
                        if (activity.userData.isInboundREST || activity.userData.type === "azureApiAppInboundService") {
                            
                            if (!_startWebServer) {
                                http = require('http');
                                express = require('express');
                                swaggerize = require('swaggerize-express');
                                bodyParser = require('body-parser');
                                app = express();
                                _startWebServer = true;
                            }
                            newMicroService.App = app;
                        }
                        callback(null, 'done');
                    }
                    catch (ex) {
                        console.log('Unable to start service '.red + newMicroService.Name.red);
                        if (typeof ex === 'object')
                            console.log(ex.message.red);
                        else
                            console.log(ex.red);
                        
                        exceptionsLoadingItineraries++;
                        callback(null, 'exception');
                    }
                }
            ], done);
        }
        catch (ex2) {
            console.log('Unable to start service.'.red);
            console.log(ex2.message.red);
        }
    }
    
    // The listner is used for incoming REST calls and is started
    // only if there is an inbound REST service
    function startListen() {
        if (!_startWebServer)
            return;
        
        try {
            if (settings.port != undefined)
                port = settings.port;
            
            console.log("Listening to port: " + settings.port);            
            console.log();
            
            app.use(bodyParser.json());
            server = http.createServer(app);
            
            /*
            generateSwagger();
            
            app.use(swaggerize({
                api: require(rootFolder + '/swagger.json'),
                docspath: '/swagger/docs/v1'
            }));
            */

            // parse application/x-www-form-urlencoded
            app.use(bodyParser.urlencoded({ extended: false }))
            
            // parse application/json
            app.use(bodyParser.json())
             
            app.use(function (req, res) {
                res.header('Content-Type', 'text/html');
                var response = '<style>body {font-family: "Helvetica Neue",Helvetica,Arial,sans-serif; background: rgb(52, 73, 94); color: white;}</style>';
                response += '<h1><img src="https://microservicebus.com/Images/Logotypes/Logo6.svg" style="height:75px"/> Welcome to the ' + settings.nodeName+' node</h1><h2 style="margin-left: 80px">API List</h2>';
                
                app._router.stack.forEach(function (endpoint) {
                    if (endpoint.route != undefined) {
                        if (endpoint.route.methods["get"] != undefined && endpoint.route.methods["get"] == true)
                            response += '<div style="margin-left: 80px"><b>GET</b> ' + endpoint.route.path + "</div>";
                        if (endpoint.route.methods["delete"] != undefined && endpoint.route.methods["delete"] == true)
                            response += '<div style="margin-left: 80px"><b>DELETE</b> ' + endpoint.route.path + "</div>";
                        if (endpoint.route.methods["post"] != undefined && endpoint.route.methods["post"] == true)
                            response += '<div style="margin-left: 80px"><b>POST</b> ' + endpoint.route.path + "</div>";
                        if (endpoint.route.methods["put"] != undefined && endpoint.route.methods["put"] == true)
                            response += '<div style="margin-left: 80px"><b>PUT</b> ' + endpoint.route.path + "</div>";
                    }
                });

                res.send(response);
            })

            
            app.use('/', express.static(__dirname + '/html'));
            
            console.log("REST endpoints:".green);
            app._router.stack.forEach(function (endpoint) {
                if (endpoint.route != undefined) {
                    if (endpoint.route.methods["get"] != undefined && endpoint.route.methods["get"] == true)
                        console.log("GET:    ".yellow + endpoint.route.path);
                    if (endpoint.route.methods["delete"] != undefined && endpoint.route.methods["delete"] == true)
                        console.log("DELETE: ".yellow + endpoint.route.path);
                    if (endpoint.route.methods["post"] != undefined && endpoint.route.methods["post"] == true)
                        console.log("POST:   ".yellow + endpoint.route.path);
                    if (endpoint.route.methods["put"] != undefined && endpoint.route.methods["put"] == true)
                        console.log("PUT:    ".yellow + endpoint.route.path);
                }
            });
            
            if(settings.enableKeyPress == false)
                var port = process.env.PORT || 1337;
            
            server = http.createServer(app).listen(port, function (err) {
                console.log("Server started on port: ".green + port);
                console.log();
            });
        }
        catch (e) {
            console.log('Unable to start listening on port ' + port);
        }
    }
    
    // Create a swagger file
    function generateSwagger() {
        // Load template
        try {
            var data = fs.readFileSync(__dirname + '/swaggerTemplate.json');
            var swagger = JSON.parse(data);
            data = fs.readFileSync(__dirname + '/swaggerPathTemplate.json');
            var pathTemplate = JSON.parse(data);
            
            for (var i = 0; i < app._router.stack.length; i++) {
                var endpoint = app._router.stack[i];
                if (endpoint["route"] != undefined) {
                    
                    if (swagger.paths[endpoint.route.path] == undefined)
                        swagger.paths[endpoint.route.path] = {};
                    
                    if (endpoint.route.methods.get) {
                        swagger.paths[endpoint.route.path].get = pathTemplate['get']
                    }
                    if (endpoint.route.methods.delete) {
                        swagger.paths[endpoint.route.path].delete = pathTemplate['delete']
                    }
                    if (endpoint.route.methods.post) {
                        swagger.paths[endpoint.route.path].post = pathTemplate['post']
                    }
                    if (endpoint.route.methods.put) {
                        swagger.paths[endpoint.route.path].put = pathTemplate['put']
                    }
                }
            }
            swagger["host"] = "localhost:" + port;
            var swaggerData = JSON.stringify(swagger);
            
            fs.writeFileSync(__dirname + '/swagger.json', swaggerData);

        }
        catch (err) {
            console.log('Invalid swagger file.'.red);
            console.log(JSON.stringify(err).red);
            process.abort();
        }
    }
    
    // Returns the next services in line to be executed.
    function getSuccessors(integrationMessage) {
        
        var itinerary = integrationMessage.Itinerary;
        var serviceName = integrationMessage.LastActivity;
        var lastActionId = itinerary.activities.find(function (action) { return action.userData.id === serviceName; }).id;
        
        var connections = itinerary.activities.filter(function (connection) {
            return connection.type === 'draw2d.Connection' && connection.source.node === lastActionId;
        });
        
        var successors = [];
        
        connections.forEach(function (connection) {
            if (connection.source.node == lastActionId) {
                var successor = itinerary.activities.find(function (action) { return action.id === connection.target.node; });
                
                if (validateRoutingExpression(successor, integrationMessage)) {
                    var destination = successor.userData.config.generalConfig.find(function (c) { return c.id === 'host'; }).value;
                    
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
            var routingExpression = actitity.userData.config.staticConfig.find(function (c) { return c.id === 'routingExpression'; });
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
            routingExpression.value = routingExpression.value.replace("var route =", "route =");
            expression = '"use strict"; var message =' + messageString + ';\n' + varialbesString + routingExpression.value;
            
            var route;
            var o = eval(expression); // jshint ignore:line
            return route;
        }
    catch (ex) {
            console.log("Unable to run script: ".red + expression.gray);
            throw "Unable to run script: " + expression;
        }
    }
    
    // Submits tracking data to host
    function trackMessage(msg, lastActionId, status) {
        
        if (typeof msg._messageBuffer != "string") {
            msg._messageBuffer = msg._messageBuffer.toString('base64');
           // msg.MessageBuffer = msg._messageBuffer;
        }

        var time = moment();
        var utcNow = time.utc().format('YYYY-MM-DD HH:mm:ss.SSS');
        var messageId = guid.v1();
        
        if (msg.IsFirstAction && status == "Completed")
            msg.IsFirstAction = false;
        
        // Remove message if encryption is enabled?
        if (settings.useEncryption == true) {
            msg._messageBuffer = new Buffer("[ENCRYPTED]").toString('base64');
        }

        var trackingMessage = {
            _message : msg._messageBuffer,
            ContentType : msg.ContentType,
            LastActivity : lastActionId,
            NextActivity : null,
            Node : settings.nodeName,
            MessageId: messageId,
            OrganizationId : settings.organizationId,
            InterchangeId : msg.InterchangeId,
            ItineraryId : msg.ItineraryId,
            IntegrationName : msg.IntegrationName,
            Environment : msg.Environment,
            TrackingLevel : msg.TrackingLevel,
            IntegrationId : msg.IntegrationId,
            IsFault : false,
            IsEncrypted : settings.useEncryption == true,
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
        var utcNow = time.utc().format('YYYY-MM-DD HH:mm:ss.SSS');
        var messageId = guid.v1();
        
        var trackingMessage =
 {
            _message : msg.MessageBuffer,
            ContentType : msg.ContentType,
            LastActivity : lastActionId,
            NextActivity : null,
            Node : settings.nodeName ,
            MessageId: messageId,
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
            State : status
        };
        com.Track(trackingMessage);
        applicationinsights.trackException(trackingMessage);
    };
    
    // Submits the messagee to the hub to show up in the portal console
    function log(message) {
    }
    
    var intercept = require("intercept-stdout"),
        captured_text = "";
    
    var unhook_intercept = intercept(function (message) {
        if (settings.debug != null && settings.debug == true) {// jshint ignore:line  
            client.invoke( 
                'integrationHub',
		        'logMessage',	
		        settings.nodeName,
                message,
                settings.organizationId);
        }
    });
    
    // this function is called when you want the server to die gracefully
    // i.e. wait for existing connections
    var gracefulShutdown = function () {
        console.log("bye")
        client.invoke('integrationHub', 'pingResponse', settings.nodeName , os.hostname(), "Offline", settings.organizationId);
        console.log("Received kill signal, shutting down gracefully.");
        console.log(settings.nodeName + ' signing out...');
        setTimeout(function () {
            client.end();
            process.exit();
        }, 100);
        
    }
    
    MicroServiceBusHost.prototype.Start = function (testFlag) {
        if (!testFlag) {
            // listen for TERM signal .e.g. kill 
            process.on('SIGTERM', gracefulShutdown);
            
            // listen for INT signal e.g. Ctrl-C
            process.on('SIGINT', gracefulShutdown);
            
            process.on('uncaughtException', function (err) {
                if (err.errno === 'EADDRINUSE' || err.errno === 'EACCES') {
                    console.log("");
                    console.log("Error: ".red + "The address is in use. Either close the program is using the same port, or change the port of the node in the portal.".yellow);
                }
                else
                    console.log('Uncaught exception: '.red + err);
            });
        }
        var args = process.argv.slice(2);

        if (args.length == 1 && args[0] == '-r') { 
            console.log('RESTORING'.yellow);
            require("./restore.js");
            return;
        }
        else if (settings.hubUri != null && settings.nodeName != null && settings.organizationId != null) { // jshint ignore:line
            if (args.length > 0 && (args[0] == '/n' || args[0] == '-n')) {
                settings.nodeName = args[1];
            }
            console.log('Logging in using settings'.grey);
        }

        /* istanbul ignore if */
        else if (args.length > 0) { // Starting using code
            switch (args[0]) {
                case '/c':
                case '-c':
                case '-code':
                case '/code':
                    temporaryVerificationCode = args[1];
                    
                    if (args[2] != null && args[3] != null && // jshint ignore:line
                        (args[2] == '/n' || 
                        args[2] == '-n' ||
                        args[2] == '/node' ||
                        args[2] == '-node'))
                        existingHostName = args[3];
                    
                    break;
                default: {
                    console.log('Sorry, invalid arguments.'.red);
                    console.log('To start the host using temporary verification code, use the /code paramenter.'.yellow);
                    console.log('Eg: node start.js -c ABCD1234'.yellow);
                    console.log('');
                    console.log('You can also specify the node:'.yellow);
                    console.log('Eg: node start.js -c ABCD1234 -n nodejs00001'.yellow);
                    console.log('');
                    console.log("If you've installed the package globaly you can simplify by typing:".yellow);
                    console.log('Eg: nodestart -c ABCD1234 -n nodejs00001'.yellow);
                    console.log('');
                    self.onStarted(0, 1);
                    if (!testFlag)
                        process.abort();
                    self.onStarted(0, 1);
                }
            }
        }
        /* istanbul ignore if */
        else {// Wrong config
            if (temporaryVerificationCode != null) { // jshint ignore:line
    
            }
            else {
                if (process.argv.length != 4) {
                    console.log('');
                    console.log('Missing arguments'.red);
                    console.log('Make sure to start using arguments; verification code (/c) and optionally host name.'.yellow);
                    console.log(' If you leave out the host name, a new host will be generated for you'.yellow);
                    console.log('node start.js /c <Verification code> [/n <Node name>]'.yellow);
                    console.log('Eg: node start.js /c V5VUYFSY [/n MyHostName]'.yellow);
                    self.onStarted(0, 1);
                    if (!testFlag)
                        process.abort();
                    self.onStarted(0, 1);
                }
                
                settings.nodeName = process.argv[3];
                settings.organizationId = process.argv[2];
                settings.machineName = os.hostname();
                
                if (settings.debug == null) // jshint ignore:line
                    settings.debug = false;
                
                
                if (settings.hubUri == null) // jshint ignore:line
                    settings.hubUri = "wss://microservicebus.com";
                
                util.saveSettings(settings);
                
                var nodeName = settings.nodeName != undefined? settings.nodeName:"";
                var hubUri = settings.hubUri != undefined? settings.hubUri:"";

                console.log('Node:           ' + nodeName.grey);
                console.log('Hub:            ' + hubUri.grey);
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
        
        client.start();
        
        // Startig using proper config
        if (settings.nodeName != null && settings.organizationId != null) {
            if (temporaryVerificationCode != null)
                console.log('Settings has already set. Temporary verification code will be ignored.'.gray);
            
            settings.machineName = os.hostname();
            util.saveSettings(settings);
            
            console.log('');
            console.log('Node: ' + settings.nodeName.gray);
            console.log('Hub:  ' + settings.hubUri.gray);
            console.log('');
        }
    };
    MicroServiceBusHost.prototype.Stop = function () {
        _shoutDown = true;
        for (var i in _inboundServices) {
            var service = _inboundServices[i];
            try {
                service.Stop();
                var lineStatus = "|" + util.padRight(service.Name, 20, ' ') + "| " + "Stopped".yellow + "   |" + util.padRight(" ", 40, ' ') + "|";
                console.log(lineStatus);
                service = undefined;
                //delete service;
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
            client = undefined;
            //delete client;
            onStopped();
        } 
        catch (ex) { }
    };
    MicroServiceBusHost.prototype.OnStarted = function (callback) {
        this.onStarted = callback;
    };
    MicroServiceBusHost.prototype.OnStopped = function (callback) {
        this.onStopped = callback;
    };
    MicroServiceBusHost.prototype.OnUpdatedItineraryComplete = function (callback) {
        this.onUpdatedItineraryComplete = callback;
    };
    
    // Test methods
    MicroServiceBusHost.prototype.TestOnPing = function (message) {
        try {
            OnPing(message);
        }
        catch (ex) {
            return false;
        }
        return true;
    }
    MicroServiceBusHost.prototype.TestOnChangeDebug = function (debug) {
        try {
            OnChangeDebug(debug);
        }
        catch (ex) {
            return false;
        }
        return true;
    }
    MicroServiceBusHost.prototype.TestOnUpdateItinerary = function (updatedItinerary) {
        try {
            OnUpdateItinerary(updatedItinerary);
        }
        catch (ex) {
            return false;
        }
        return true;
    }
    MicroServiceBusHost.prototype.TestOnChangeState = function (state) {
        OnChangeState(state);
        return true;
    }
}
module.exports = MicroServiceBusHost; 