var edge = require('edge');
var syncrequest = require('sync-request');
var fs = require('fs');
var AdmZip = require('adm-zip');

var me;
var installAdapter; // Install method
var applyTransmitBindings; // Install method
var isInstalled; // Check if adapter is installed method
var processMessage; // Process incoming message to BizTalk method

var zipUri = "https://blogical.blob.core.windows.net/microservicebus/biztalk/microServiceBus.BizTalk.zip";

var managementFile = 'microServiceBus.BizTalk/microServiceBus.BizTalkReceiveAdapter.Management.dll';
var runtimeFile = 'microServiceBus.BizTalk/microServiceBus.BizTalkReceiveeAdapter.RunTime.dll';
var helperFile = 'microServiceBus.BizTalk/microServiceBus.BizTalkReceiveeAdapter.Helper.dll';

var fileName = "microServiceBus.BizTalk.zip";

var application;
var port;
var location;

var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        try{
            me = this;
            application = this.GetPropertyValue('static', 'application');
            port = this.GetPropertyValue('static', 'port');
            location = this.GetPropertyValue('static', 'location');
            
            // Download files if they don't exists
            if (!fs.existsSync(managementFile)||
                !fs.existsSync(runtimeFile) ||
                !fs.existsSync(helperFile)) 
                this.DownloadFile(zipUri, fileName)
            
            // Register methods for managing BizTalk adapter
            installAdapter = edge.func({
                assemblyFile: helperFile,
                typeName: 'microServiceBus.BizTalkReceiveeAdapter.Helper.BizTalkServiceHelper',
                methodName: 'InstallAdapter'
            });
            
            applyReceiveBindings = edge.func({
                assemblyFile: helperFile,
                typeName: 'microServiceBus.BizTalkReceiveeAdapter.Helper.BizTalkServiceHelper',
                methodName: 'ApplyReceiveBindings'
            });
            applyTransmitBindings = edge.func({
                assemblyFile: helperFile,
                typeName: 'microServiceBus.BizTalkReceiveeAdapter.Helper.BizTalkServiceHelper',
                methodName: 'ApplyTransmitBindings'
            });
            
            processMessage = edge.func({
                assemblyFile: helperFile,
                typeName: 'microServiceBus.BizTalkReceiveeAdapter.Helper.BizTalkServiceHelper',
                methodName: 'ProcessMessage'
            });

            // Install adapter
            installAdapter(null, function (error, result) {
               if (error || result != null)
                    throw 'An error occurd while installing the adapter.' + result;
                else
                    me.Debug('Adapter has been successfully installed');
            });
            
            // Install Send port
            var applyReceiveBindingsParams = {
                applicationName: application,
                receivePort: port,
                receiveLocation: location
            };
            
            // Create send port
           applyReceiveBindings(applyReceiveBindingsParams, function (error, result) {
                if (error || result != null)
                    throw 'An error occurd while installing the adapter.' + result;
                else
                    console.log('Adapter bindings has been successfully applied');
            });
        }
        catch (ex) {
           this.ThrowError(null, '00001', 'Unable to install BizTalk adapter' + ex.message);
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
        var payload;
        try{
             this.Debug('Process: Received message');
            if (context.ContentType == 'application/json')
                payload = JSON.stringify(message);
            else if(context.ContentType == 'application/xml' || context.ContentType == 'text/plain'){
                payload = message;
            }
            else{
                throw 'Content type is not supported.';
            }
            
            var processParams = {
                message: payload,
                context: context,
                location: location
            };
            // Call Process message
            processMessage(processParams, function (error, result) {
                if (error || !result) 
                    throw 'An error occurd when transmitting the message to the adapter.' + error;
                 me.Done(context, this.Name);
                 me.Debug('Process: Sucessbully submitted to BizTalk ' + processParams.submitURI);
            });
        }
        catch (ex) {
            this.ThrowError(context, '00001', 'Unable to install BizTalk adapter' + ex.message);
        }
        
       
    },   
    DownloadFile: function(zipUri,fileName){
        try {
            this.Debug('DownloadFile: ' + fileName);
            // Download zipfile from blob storage
            var httpResponse = syncrequest('GET', zipUri);
            if (httpResponse.statusCode != 200)
                throw 'Unable to download file: ' + fileName;
            
            // Save file
            fs.writeFileSync(fileName, httpResponse.body);
            
            // Unzip file
            var zip = new AdmZip(fileName);
            zip.extractAllTo("", true);

            fs.unlinkSync(fileName);
        }
        catch (ex) {
            this.ThrowError(null, '00001', 'Unable to install BizTalk adapter' + ex.message);  
        }  
    },
};
