
var guid = require('guid');
var linq = require('node-linq').LINQ;
var JSZip;

var zipFileName;
var password;
var compressionLevel;

var exports = module.exports = {
    
    Start : function () {
        this.AddNpmPackage('jszip',true, function(er){
            if(er === null){
               JSZip = require("jszip");
            }
            else{
                this.Error(this.Name,'00001', 'Unable to load package node-zip');
                return;
            }
        });
        
        password = this.GetPropertyValue('static', 'password');
        compressionLevel = this.GetPropertyValue('static', 'compressionLevel');
    },
    Stop : function () {},    
    
    // The Process method is called from the host as it receives 
    // messages from the hub. The [messasge] parameter is a JSON 
    // object (the payload) and the [context] parameter is a 
    // value/pair object with parameters provided by the hub.
    Process : function (payload, context) {
        this.Debug('Before: ' + payload);
        var fileExtension;
        var zip = new JSZip();
        var ext = new linq(context.Variables)
                                .First(function (v) { return v.Variable === '_fileExtension'; });
        if (ext == null)
            fileExtension = '';
        else
            fileExtension = ext.Value;
            
        var fileName = guid.raw() + fileExtension;
        
        var content = '';
        if(context.ContentType == 'application/json')
            content = JSON.stringify(payload);
        else
            content = payload;
            
        zip.file(fileName, content);
         
        var zipContent = zip.generate({type:"base64"});
        
        var buffer = new Buffer(zipContent, 'base64');
        this.SubmitMessage(buffer, 'application/x-compress',context.Variables);
        
        this.Debug('After: '+ JSON.stringify(message));
    },    
}
