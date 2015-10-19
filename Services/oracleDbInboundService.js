var oracledb;// = require('oracledb');
var connection;
var linq = require('node-linq').LINQ;
var guid = require('guid');
var timerEvent; // In case you use a timer for fetching data
 
var server;
var tns;
var service;
var port;
var dataExistsQuery;
var sqlQuery;
var interval;

var connectionData;
var authType;
var userName;
var password;
var config;
var executeImmediately;
var connectData;
var me;
var contenttype = 'application/json';

var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        server = this.GetPropertyValue('static', 'server');
        tns = this.GetPropertyValue('static', 'tns');
        service = this.GetPropertyValue('static', 'service');
        dataExistsQuery = this.GetPropertyValue('static', 'dataExistsQuery');
        sqlQuery = this.GetPropertyValue('static', 'sqlQuery');
        interval = this.GetPropertyValue('static', 'interval');
        executeImmediately = this.GetPropertyValue('static', 'executeImmediately');
        userName = this.GetPropertyValue('security', 'userName');
        password = this.GetPropertyValue('security', 'password');
        
        me = this;
        
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
                    me.Debug('Connectionstring set');
                    if(executeImmediately)
                        me.ExecuteSQL();
                    
                    // The timer event is used for creating message on a 
                    // scheduled interval.
                    timerEvent = setInterval(function () {
                        me.ExecuteSQL();
                    }, interval);
                }
                else{
                    this.ThrowError('Unable to start oracle inbound service');
                    return;
                }
            });
        }
        catch(err){
            this.ThrowError('Unable to start oracle inbound service. ' + err.message);
        }
    },

    // The Stop method is called from the Host when the Host is 
    // either stopped or has updated integrations. 
    Stop : function () {
       clearInterval(timerEvent);
    },    
    
    ExecuteSQL : function () {
        me.Debug('ExecuteSQL started');
        oracledb.getConnection(connectionData,function (err, connection) {
            if (err) {
                me.ThrowError(null,'00001',err.message);
                return;
            }
            me.Debug('Connected...');

            connection.execute(dataExistsQuery, function (err, result) {
                me.Debug('Data exists called');
                if (err) {
                    me.ThrowError(null, '00002', err.message);
                    return;
                }
                else {
                    
                    if (result.rows[0][0] > 0) { // Has rows?
                        connection.execute(sqlQuery, function (err, result) {
                            if (err) {
                                me.ThrowError(null, '00002', err.message);
                                return;
                            }
                            else {
                                // Build response...
                                var varaiables = [
                                    { Variable: 'Server', Type: 'String', Value: server },
                                    { Variable: 'Service', Type: 'String', Value: service }];
                                
                                me.Debug('Submitting data');
                                me.SubmitMessage(result, "application/json", varaiables);
                            }
                        });
                    }
                }
            });
         });
    },
    
    Process : function (message, context) {},    
}
