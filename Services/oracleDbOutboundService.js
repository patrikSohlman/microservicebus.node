var oracledb;
var linq = require('node-linq').LINQ;
var guid = require('guid');
var sqlCommand = require('./sqlCommand.js');

var server;
var database;
var authType;
var userName;
var password;
var config;
var me;
var connectionData;

var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        me = this;
        server = this.GetPropertyValue('static', 'server');
        tns = this.GetPropertyValue('static', 'tns');
        port = this.GetPropertyValue('static', 'port');
        service = this.GetPropertyValue('static', 'service');
        userName = this.GetPropertyValue('security', 'userName');
        password = this.GetPropertyValue('security', 'password');
        
        try{
            this.AddNpmPackage('oracledb', true, function(err){
                if(err == null || err == ""){
                    oracledb = require('oracledb');
                    
                    var connectStr;
                    if(tns != null && tns.length > 0)
                        connectStr = tns;
                    else
                        connectStr = server+":"+port+"/"+service;    
                    
                    connectionData = {
                        user          : userName,
                        password      : password,
                        connectString : connectStr
                    };        
                }
                else{
                    this.ThrowError(null, '00001', 'Unable to start oracle inbound service');
                    return;
                }
            });
        }
        catch(err){
            this.ThrowError(null, '00001', 'Unable to start oracle inbound service' + err.message);
        }
    },
    
    // The Stop method is called from the Host when the Host is 
    // either stopped or has updated integrations. 
    Stop : function () { },    
    
    // The Process method is called from the host as it receives 
    // messages from the hub. The [messasge] parameter is a JSON 
    // object (the payload) and the [context] parameter is a 
    // value/pair object with parameters provided by the hub.
    Process : function (message, context) {
        var cmd = sqlCommand.getCommand(message, "", "");
        
        if(cmd.error != null){
            this.ThrowError(context, '00001', cmd.error);
            return;
        }
        
        oracledb.getConnection(connectionData,function (err, connection) {
            if (err) {
                me.ThrowError(context, '00001', err.message);
                return;
            }

            connection.execute(cmd.command, function (err, result) {
                if (err) {
                    me.ThrowError(context, '00002', err.message);
                    return;
                }
                else {
                    me.SubmitResponseMessage(result, context, 'application/json');
                }
            });
        });
    },   
};
