/* 
* This script was originaly been created by microservicebus.com
*/
var chokidar = require('chokidar');
var fs = require('fs');
var path = require('path');
var linq = require('node-linq').LINQ;
var guid = require('guid');

var dir;
var createDirectory;
var fileName;

var mkdirSync = function (path) {
    try {
        if(!fs.existsSync(path))
            fs.mkdirSync(path);
    } catch (e) {
        if (e.code != 'EEXIST') throw e;
    }
}
var mkdirpSync = function (dirpath) {
    var parts = dirpath.split(path.sep);
    for (var i = 1; i <= parts.length; i++) {
        var p = path.join.apply(null, parts.slice(0, i));
        mkdirSync(p);
    }
}

var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        dir = this.GetPropertyValue('static', 'path');
        createDirectory = this.GetPropertyValue('static', 'createDirectory');
        fileName = this.GetPropertyValue('static', 'fileName');
        
        if (createDirectory && !fs.existsSync(dir)) {
            mkdirpSync(dir);
        }
    },
    
    // The Stop method is called from the Host when the Host is 
    // either stopped or has updated integrations. 
    Stop : function () {},    
    
    // The Process method is called from the host as it receives 
    // messages from the hub. The [messasge] parameter is a JSON 
    // object (the payload) and the [context] parameter is a 
    // value/pair object with parameters provided by the hub.
    Process : function (message, context) {
        var f = fileName.replace('%MessageId%', guid.raw());
        f = this.ParseString(f, message, context);
        var p = path.join(dir, f)
        
        var wstream = fs.createWriteStream(p);
        
        if (context.ContentType == 'application/json'){
            message = JSON.stringify(message);
            wstream.write(message);
        }
        else if (context.ContentType == 'text/plain' || context.ContentType == 'application/xml')
            wstream.write(message);
        else {
            var buffer = new Buffer(message, 'base64');
            wstream.write(buffer);
        }
        wstream.end();
        
        this.Done(context, this.Name);
    },   
};
