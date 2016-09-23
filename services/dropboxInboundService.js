var path = require('path');
var Dropbox;
var accessToken;
var interval;
var directory;
var me;
var timerEvent;
var client;

var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        me = this;
        interval = this.GetPropertyValue('static', 'interval');
        executeImmediately = this.GetPropertyValue('static', 'executeImmediately');
        directory = this.GetPropertyValue('static', 'directory');
        
        accessToken = this.GetPropertyValue('security', 'accessToken');
        
        contentType = this.GetPropertyValue('static', 'contentType');
        
        if (!directory.match(/\/$/)) {
            directory += '/';
        }
        
        if (directory == "/") {
            directory = "";
        }
        
        interval = interval * 1000;
        
        this.AddNpmPackage('dropbox', true, function(err){
            if(err == null || err == ""){
                Dropbox = require('dropbox');
                
                client = new Dropbox({ accessToken: accessToken });
                
                if(executeImmediately)
                    me.ReadDirectory();
                    
                timerEvent = setInterval(function () {
                    me.ReadDirectory();
                }, interval);
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
       clearInterval(timerEvent);
    },    
    
    ReadDirectory : function (config) { 
       // Server-side applications use both the API key and secret.
       client.filesListFolder({ path: directory })
        .then(function (response) {
            response.entries.forEach(function (entry) {
                if (entry[".tag"] === "file") {
                    var url = "https://www.dropbox.com/s/dvs8b2eqoj36ipx/c5ff1b81-68ad-11e6-822f-f7110221373c.txt?dl=0";
                    client.sharingGetSharedLinkFile({ url: url })
                        .then(function (data) {
                            fs.writeFile(data.name, data.fileBinary, 'binary', function (err) {
                                if (err) { throw err; }
                                console.log('File: ' + data.name + ' saved.');
                            });
                        })
                        .catch(function (err) {
                            throw err;
                        });
                }
            });
        })
        .catch(function (err) {
          me.ThrowError(null, err.status, err.error);
        });
       
       
       /*
       client.readdir(directory, function(error, entries) {
            if (error) {
                me.ThrowError(null, '00006', error.message);  // Something went wrong.
                return;
            }
    
            entries.forEach(function(entry){
                var file = directory + entry;
                client.readFile(file, function(error, data) {
                    if (error) {
                        me.ThrowError(null, '00007', error.message);  // Something went wrong.
                        return;
                    }
                    me.SubmitMessage(data, contentType, []);
                    me.Debug('Successfully received file from Dropbox');
                    client.remove(file, function(error){
                        if (error) {
                            me.ThrowError(null, '00008', 'Unable to remore file.');  // Something went wrong.
                            return;
                        }   
                        me.Debug('Successfully removed file from Dropbox');
                    });
                    
                });
            });
        });
        */
    },
    
    Process : function (message, context) { },    
}
