var sql = require('mssql');
var linq = require('node-linq').LINQ;
var guid = require('guid');
var sqlCommand = require('./sqlCommand.js');

var server;
var database;
var authType;
var userName;
var password;
var connection;
var me;
var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        me = this;
        server = this.GetPropertyValue('static', 'server');
        database = this.GetPropertyValue('static', 'database');
        userName = this.GetPropertyValue('security', 'userName');
        password = this.GetPropertyValue('security', 'password');
        
        this.AddNpmPackage('mysql', true, function (err) {
            if (err == null || err == "") {
                mysql = require('mysql');
                connection = mysql.createConnection({
                    host     : server,
                    user     : userName,
                    password : password,
                    database : database
                });
            }
            else {
                this.Error(this.Name, '00001', 'Unable to start mySql inbound service');
                this.Error(this.Name, '00001', err);
                return;
            }
        });
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
            this.Error(this.Name, '00001',cmd.error);
            return;
        }
        
        var request = new sql.Request(connection);
            connection.query(cmd.command, function (err, rows, fields) {
                if (err != null)
                    me.Error(me.Name, '000001', err);
                else {
                    //var response = recordset.toTable();
                    me.SubmitResponseMessage(rows, context, 'application/json');
                }
            });
    },   
};
