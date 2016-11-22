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
var colors = require('colors');
var signalR = require('./signalR.js');
var moment = require('moment');
var async = require('async');
var extend = require('extend');
var reload = require('require-reload')(require);
var os = require("os");
var fs = require('fs');
var path = require('path');
var util = require('./Utils.js');
var guid = require('uuid');
var pjson = require('../package.json');
var keypress = require('keypress');
var intercept = require("intercept-stdout");

function MicroServiceBusHost(settings) {
    var self = this;
    // Callbacks
    this.onStarted = null;
    this.onStopped = null;
    // Handle settings
    var temporaryVerificationCode;
    var _hasDisconnected = false;
    var _shoutDown = false;
    var _firstStart = true;
    var _restoreTimeout;
    var _heartBeatInterval;
    var signInResponse;
    var memwatch;
    var logStream;
    var rootFolder = process.arch == 'mipsel' ? '/mnt/sda1':__dirname;
    var captured_text = "";
    var microServiceBusNode;
    var existingHostName;
    var _debugMode = false;

    var client = new signalR.client(
        settings.hubUri + '/signalR',
	    ['integrationHub'],                
        10, //optional: retry timeout in seconds (default: 10)
        true
    );
    
    // Wire up signalR events
    /* istanbul ignore next */
    client.serviceHandlers = {
        bound: function () { log("Connection: " + "bound".yellow); },
        connectFailed: function (error) {
            log("Connection: " + "Connect Failed".red);
        },
        connected: function (connection) {
            log("Connection: " + "Connected".green);
            microServiceBusNode.settings = settings;
            microServiceBusNode.SignIn(existingHostName, temporaryVerificationCode);
            startHeartBeat();
        },
        disconnected: function () {
            
            log("Connection: " + "Disconnected".yellow);

            clearTimeout(_restoreTimeout);
        },
        onerror: function (error) {
            log("Connection: " + "Error: ".red, error);
            try {
                if (error.endsWith("does not exist for the organization"))
                    self.onStarted(0, 1);
            }
            catch (e) { }
        },
        messageReceived: function (message) {

        },
        bindingError: function (error) {
            log("Connection: " + "Binding Error: ".red, error);
        },
        connectionLost: function (error) {
            //_isWaitingForSignInResponse = false;
            log("Connection: " + "Connection Lost".red);
        },
        reconnected: void function (connection) {
            log("Connection: " + "Reconnected ".green);
        },
        reconnecting: function (retry /* { inital: true/false, count: 0} */) {
            log("Connection: " + "Retrying to connect ".yellow);
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
        //log("received heartbeat".gray);
    });    
    client.on('integrationHub', 'forceUpdate', function () {
        log("forceUpdate".red);
        restart();
    });  
    client.on('integrationHub', 'restart', function () {
        log("restart".red);
        restart();
    });  
    client.on('integrationHub', 'reboot', function () {
        log("reboot".red);
        reboot();
    });  
    // Called by HUB if it was ot able to process the request
    function OnErrorMessage(message) {
        console.log('Error: '.red + message.red);
    };
    // Called by HUB when user clicks on the Hosts page
    function OnPing(message) {
        log("ping => " + microServiceBusNode.InboundServices().length + " active service(s)");
        
        client.invoke('integrationHub', 'pingResponse', settings.nodeName , os.hostname(), "Online", settings.organizationId);
        
    }
    // Called by HUB to receive all active serices
    function OnGetEndpoints(message) {
        console.log('OnGetEndpoints'.blue);
    }
    // Called by HUB when itineraries has been updated
    function OnUpdateItinerary(updatedItinerary) {
        microServiceBusNode.UpdateItinerary(updatedItinerary);

    }
    // Called by HUB when itineraries has been updated
    function OnChangeState(state) {
        microServiceBusNode.ChangeState(state);
    } 
    // Update debug mode
    function OnChangeDebug(debug) {
        microServiceBusNode.SetDebug(debug);
    }
    // Incoming message from HUB
    function OnSendMessage(message, destination) {
        console.log('OnSendMessage'.blue);
    }
    // Called by HUB when signin  has been successful
    function OnSignInMessage(response) {
        microServiceBusNode.SignInComplete(response);
    }
    // Called by HUB when node has been successfully created    
    /* istanbul ignore next */
    function OnNodeCreated(nodeData) {

        nodeData.machineName = os.hostname();

        settings = extend(settings, nodeData);

        log('Successfully created node: ' + nodeData.nodeName.green);

        var data = JSON.stringify(settings);

        fs.writeFileSync(rootFolder + '/settings.json', data);

        microServiceBusNode.settings = settings;
        microServiceBusNode.NodeCreated(nodeData, settings);

        client.invoke('integrationHub', 'created', nodeData.id, settings.nodeName, os.hostname(), "Online", nodeData.debug, pjson.version, settings.organizationId);
    }
    
    function startHeartBeat() {

        if (_heartBeatInterval === null || _heartBeatInterval === undefined) {
            _heartBeatInterval = setInterval(function () {
                var lastHeartBeatId = guid.v1();
                //log("sending heartbeat".gray);
                client.invoke(
                    'integrationHub',
                    'heartBeat',
                    lastHeartBeatId
                );
            }, 5 * 60 * 1000);
        }
    }
    
    function log(message) {
        message = message === undefined ? "" : message;
        if (settings.log && logStream) {
            logStream.write(new Date().toString() + ': ' + colors.strip(message) + '\r\n');
        }

        console.log(message);
    }
    
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
    /* istanbul ignore next */
    function gracefulShutdown() {
        log("bye")
        client.invoke('integrationHub', 'pingResponse', settings.nodeName , os.hostname(), "Offline", settings.organizationId);
        log("Received kill signal, shutting down gracefully.");
        log(settings.nodeName + ' signing out...');
        setTimeout(function () {
            client.end();
            abort();
        }, 100);
        
    }
    function restart() {
        log("bye")
        client.invoke('integrationHub', 'pingResponse', settings.nodeName, os.hostname(), "Offline", settings.organizationId);
        log("Received kill signal, shutting down gracefully.");
        log(settings.nodeName + ' signing out...');
        setTimeout(function () {
            client.end();
            setTimeout(function () {
                process.send({ chat: 'restart' });
            }, 500);
        }, 500);
    }
    function reboot() {
        log("bye")
        client.invoke('integrationHub', 'pingResponse', settings.nodeName, os.hostname(), "Offline", settings.organizationId);
        log("Received kill signal, shutting down gracefully.");
        log(settings.nodeName + ' signing out...');
        setTimeout(function () {
            client.end();
            setTimeout(function () {
                util.reboot();
            }, 500);
        }, 500);
    }
    function abort() {
        if (_debugMode)
            process.exit();
        else
            process.send({ chat: 'abort' });
    }
    MicroServiceBusHost.prototype.Start = function (testFlag) {
        if (testFlag) {
            _debugMode = true;
        }
        else {
            // listen for TERM signal .e.g. kill 
            process.on('SIGTERM', function (x) {
                gracefulShutdown();
            });

            // listen for INT signal e.g. Ctrl-C
            process.on('SIGINT', function (x) {
                gracefulShutdown();
            });

            process.on('uncaughtException', function (err) {
                /* istanbul ignore next */
                if (err.errno === 'EADDRINUSE' || err.errno === 'EACCES') {
                    log("");
                    log("Error: ".red + "The address is in use. Either close the program is using the same port, or change the port of the node in the portal.".yellow);
                }
                else if (err.message == 'gracefulShutdown is not defined') {
                    gracefulShutdown();
                }
                else
                    log('Uncaught exception: '.red + err);
            });
        }
        
        var args = process.argv.slice(2);

        if (settings.log) {
            logStream = fs.createWriteStream(settings.log);
        }

        // Log in using settings
        if (settings.hubUri != null && settings.nodeName != null && settings.organizationId != null) { // jshint ignore:line
            if (args.length > 0 && (args[0] == '/n' || args[0] == '-n')) {
                settings.nodeName = args[1];
            }
            log('Logging in using settings'.grey);
        }
        // First login
        else if (args.length > 0) { 
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
                    log('Sorry, invalid arguments.'.red);
                    log('To start the host using temporary verification code, use the /code paramenter.'.yellow);
                    log('Eg: node start.js -c ABCD1234'.yellow);
                    log('');
                    log('You can also specify the node:'.yellow);
                    log('Eg: node start.js -c ABCD1234 -n nodejs00001'.yellow);
                    log('');
                    log("If you've installed the package globaly you can simplify by typing:".yellow);
                    log('Eg: nodestart -c ABCD1234 -n nodejs00001'.yellow);
                    log('');
                    self.onStarted(0, 1);
                    abort();
                    return;
                }
            }
        }
         /* istanbul ignore if */
         else {// Wrong config
             /* istanbul ignore if */
             if (temporaryVerificationCode != null) { // jshint ignore:line

             }
             else {
                 if (process.argv.length != 4) {
                     log('');
                     log('Missing arguments'.red);
                     log('Make sure to start using arguments; verification code (/c) and optionally host name.'.yellow);
                     log(' If you leave out the host name, a new host will be generated for you'.yellow);
                     log('node start.js /c <Verification code> [/n <Node name>]'.yellow);
                     log('Eg: node start.js /c V5VUYFSY [/n MyHostName]'.yellow);
                     self.onStarted(0, 1);
                     abort();
                     return;
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

                 log('Node:           ' + nodeName.grey);
                 log('Hub:            ' + hubUri.grey);
                 log('');
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

        var MicroServiceBusNode = require("microservicebus.core");
        microServiceBusNode = new MicroServiceBusNode(settings);
        microServiceBusNode.nodeVersion = pjson.version;
        microServiceBusNode.OnStarted(function (loadedCount, exceptionCount) {
            self.onStarted(loadedCount, exceptionCount);
        });
        microServiceBusNode.OnStopped(function () {

        });
        microServiceBusNode.OnSignedIn(function (hostData) {
            hostData.npmVersion = pjson.version
            client.invoke(
                'integrationHub',
                'SignIn',
                hostData
            );
        });
        microServiceBusNode.OnPingResponse(function () {
            client.invoke(
                'integrationHub',
                'pingResponse',
                settings.nodeName,
                os.hostname(),
                "Online",
                settings.organizationId);
        });
        microServiceBusNode.OnLog(function (message) {
            log(message);
        });
        microServiceBusNode.OnCreateNode(function (temporaryVerificationCode, hostPrefix, existingHostName) {
            client.invoke(
                'integrationHub',
                'createHost',
                temporaryVerificationCode,
                hostPrefix,
                existingHostName
            );
        });
        microServiceBusNode.OnUpdatedItineraryComplete(function () {

        });

        client.start();
        
        // Startig using proper config
        if (settings.nodeName != null && settings.organizationId != null) {
            if (temporaryVerificationCode != null)
                log('Settings has already set. Temporary verification code will be ignored.'.gray);
            
            settings.machineName = os.hostname();
            util.saveSettings(settings);
            
            log('');
            log('Node: ' + settings.nodeName.gray);
            log('Hub:  ' + settings.hubUri.gray);
            log('');
        }
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