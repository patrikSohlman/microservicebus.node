var path = require('path');
var guid = require('uuid');
var moment = require('moment');
var Dropbox;
var accessToken;
var interval;
var fileName;
var me;
var client;

var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        me = this;
        fileName = this.GetPropertyValue('static', 'fileName');
        
        accessToken = this.GetPropertyValue('security', 'accessToken');
        
        this.AddNpmPackage('dropbox', true, function(err){
            if(err == null || err == ""){
                Dropbox = require('dropbox');
                
                client = new Dropbox({ accessToken: accessToken });
                
            }
            else{
                this.ThrowError(null, '00001', 'Unable to start Dropbox inbound service');
                this.ThrowError(null, '00001', err.message);
                return;
            }
        });
        
        
    },

    // The Stop method is called from the Host when the Host is 
    // either stopped or has updated integrations. 
    Stop : function () {
    },    
    
    Process : function (message, context) {
        time = moment();
        var f = fileName.replace('%MessageId%', guid.v1());
            f = f.replace('%guid%', guid.v1());
            f = f.replace('%utcdatetime%', time.utc().format('YYYY-MM-DDTHHmmss'));
            f = f.replace('%datetime%', time.format('YYYY-MM-DD HHmmss'));
            
            f = this.ParseString(f, message, context);
        
        if (!f.startsWith("/")) {
            f = "/" + f;
        }

        if (context.ContentType == 'application/json'){
            message = JSON.stringify(message);
        }
        client.filesUpload({ path: f, contents: message })
          .then(function (response) {
             me.Debug('Successfully save file to Dropbox');
             me.Done(context, me.Name);
          })
          .catch(function (err) {
              me.ThrowError(context, err.status, err.error);
          });
       
    }
}
