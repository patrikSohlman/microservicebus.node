var async = require('async');
var express = require('express');
var bodyParser = require('body-parser')
var onMessageReceivedCallback = null;
var base;
var app = express();
var server;
var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        var uri = this.GetPropertyValue('static', 'uri');
        var verb = this.GetPropertyValue('static', 'verb');
        var accept = this.GetPropertyValue('static', 'accept');
        var contenttype = this.GetPropertyValue('static', 'contenttype');
        var port = this.GetPropertyValue('static', 'port');
        var verbs = verb.split(",")
        
        //app.use(bodyParser.urlencoded());
        app.use(bodyParser.json());
        
        base = this;
        
        // Process GET commands
        if((verbs.indexOf("GET") > -1)){
            app.get(uri, function (req, res) {
                try {
                    base.Debug('Receive:' + req.query);
                    var message = { header : req.query };
                    var variables = [
                        { Variable: '_verb', Type: 'String', Value: 'GET' },
                        { Variable: '_uri', Type: 'String', Value: uri },
                        { Variable: '_accept', Type: 'String', Value: accept }
                    ];
                    base.SubmitMessage(message, 
                                'application/json',
                                variables);
                    
                    base.OnResponseReceived(function (response, context) {
                        res.send(response);
                        base.Debug('Response:' + response);
                        base.Done(context, base.Name);

                    });
                }
                catch (ex) { 
                    base.Error(base.Name, '00001', ex.message);
                }
            })
        };
        
        // Process DELETE commands
        if((verbs.indexOf("DELETE") > -1)){
            app.delete(uri, function (req, res) {
                try {
                    base.Debug('Receive:' + req.query);
                    var message = { header : req.query };
                    var variables = [
                        { Variable: '_verb', Type: 'String', Value: 'DELETE' },
                        { Variable: '_uri', Type: 'String', Value: uri },
                        { Variable: '_accept', Type: 'String', Value: accept }
                    ];
                    base.SubmitMessage(message, 
                                'application/json',
                                variables);
                    
                    base.OnResponseReceived(function (response, context) {
                        res.send(response);
                        base.Debug('Response:' + response);
                        base.Done(context, base.Name);

                    });
                }
                catch (ex) { 
                    base.Error(base.Name, '00001', ex.message);
                }
            })
        };
        
         // Process POST commands
        if((verbs.indexOf("POST") > -1)){
            app.post(uri, function (req, res) {
                try {
                    var message = { header : req.query, body: req.body };
                    
                    var variables = [
                        { Variable: '_verb', Type: 'String', Value: 'POST' },
                        { Variable: '_uri', Type: 'String', Value: uri },
                        { Variable: '_accept', Type: 'String', Value: accept }
                    ];
                    
                    base.SubmitMessage(message, 
                                'application/json',
                                variables);
                    
                    base.OnResponseReceived(function (response, context) {
                        res.send(response);
                        base.Debug('Response:' + response);
                        base.Done(context, base.Name);

                    });
                }
                catch (ex) {
                    base.Error(base.Name, '00001', ex.message);
                }
            })
        };
        
        // Process PUT commands
        if((verbs.indexOf("PUT") > -1)){
            app.put(uri , function (req, res) {
                try {
                    var message = { header : req.query, body: req.body };
                    
                    var variables = [
                        { Variable: '_verb', Type: 'String', Value: 'PUT' },
                        { Variable: '_uri', Type: 'String', Value: uri },
                        { Variable: '_accept', Type: 'String', Value: accept }
                    ];
                    
                    base.SubmitMessage(message, 
                                'application/json',
                                variables);
                    
                    base.OnResponseReceived(function (response, context) {
                        res.send(response);
                        base.Debug('Response:' + response);
                        base.Done(context, base.Name);

                    });
                }
                catch (ex) {
                    base.Error(base.Name, '00001', ex.message);
                }
            })
        };
        
        server = app.listen(port)
    },
    Stop : function () {
        async.series([
            function (callback) {
                server.close(callback);
            }]
        );
    },    
    
    // The Process method is called from the host as it receives 
    // messages from the hub. The [messasge] parameter is a JSON 
    // object (the payload) and the [context] parameter is a 
    // value/pair object with parameters provided by the hub.
    Process : function (payload, context) {
        onMessageReceivedCallback(payload, context);
    },    
    OnResponseReceived : function (callback) {
        onMessageReceivedCallback = callback;
    },
}
