var edge = require('edge');
var syncrequest = require('sync-request');
var fs = require('fs');
var AdmZip = require('adm-zip');
var net = require('net');

var me;
var server;
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
var sendPort;
var address;
var port;
var contentType;

var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        try{
            me = this;
            application = this.GetPropertyValue('static', 'application');
            sendPort = this.GetPropertyValue('static', 'sendPort');
            port = parseInt(this.GetPropertyValue('static', 'port'));
            address = this.GetPropertyValue('static', 'address');
            contentType = this.GetPropertyValue('static', 'contentType');
            
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
            
            applyTransmitBindings = edge.func({
                assemblyFile: helperFile,
                typeName: 'microServiceBus.BizTalkReceiveeAdapter.Helper.BizTalkServiceHelper',
                methodName: 'ApplyTransmitBindings'
            });
            

            // Install adapter
            installAdapter(null, function (error, result) {
               if (error || result != null)
                    throw 'An error occurd while installing the adapter.' + result;
                else
                    me.Debug('Adapter has been successfully installed');
            });
            
            // Install Send port
            var applyTransmitBindingsParams = {
                applicationName: application,
                sendPort: sendPort,
                address: address,
                port: port,
                contentType: contentType
            };
            
            // Create send port
           applyTransmitBindings(applyTransmitBindingsParams, function (error, result) {
                if (error || result != null)
                    throw 'An error occurd while installing the adapter.' + result;
                else
                    me.Debug('Adapter bindings has been successfully applied');
            });
            
            this.StartListener();
        }
        catch (ex) {
           this.ThrowError(null, '00001', 'Unable to install BizTalk adapter' + ex.message);
        }
    },
    
    // The Stop method is called from the Host when the Host is 
    // either stopped or has updated integrations. 
    Stop : function () {
        server.close();
    },    
    
    Process : function (message, context) { },   
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
    StartListener: function(){
        
        server = net.createServer();
        server.on("connection", function (socket) {
            socket.on("data", function (data) {
                buf = new Buffer(data, 'base64');
                msg = buf.toString('utf8');
                var payload = msg;
                var varaiables = [];
                
                me.Debug('Received data from BizTalk');
                
                if(contentType == 'application/json')
                    payload = JSON.parse(msg);
                    
                me.SubmitMessage(payload, contentType, varaiables);
                
                socket.write("Message has been received by the microServiceBus host");
            });
            socket.on("close", function () { 
                me.Debug('Socket is closed');
            });
            socket.on("error", function (error) { 
                me.Debug('Error');
            });
        });
        
        server.listen(port, function () {
            me.Debug('Socket is open');
        
        });
    }
};








