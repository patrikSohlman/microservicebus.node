var xml;
var ns;
var rootNode;

var exports = module.exports = {
    
    Start : function () {
        ns = this.GetPropertyValue('static', 'ns');
        rootNode = this.GetPropertyValue('static', 'rootNode');
        
         this.AddNpmPackage('xml', true, function(err){
            if(err == null || err == ""){
               xml = require('xml');
            }
            else{
                this.Error(this.Name, '00001', 'Unable to start the service');
                this.Error(this.Name, '00001', err);
                return;
            }
        });
    },
    Stop : function () { },    
    
    // The Process method is called from the host as it receives 
    // messages from the hub. The [messasge] parameter is a JSON 
    // object (the payload) and the [context] parameter is a 
    // value/pair object with parameters provided by the hub.
    Process : function (payload, context) {
        this.Debug('Before: ' + payload);
        if(context.ContentType != 'application/json'){
            this.Error(this.Name, '00001', 'Unsupported content type. Must be application/json')
            return;
        }
        
        var xmlString;
        var obj = {};
        if(ns != null && ns != ''){
            obj[rootNode] = [{ _attr: { xmlns: ns} }, payload];
            xmlString = xml(obj);
        }
        else{
            obj[rootNode] = [payload];
            xmlString = xml(obj);
        }
        
        this.SubmitResponseMessage(xmlString, context, 'application/xml');
        this.Debug('After: ' + JSON.stringify(message));
    },    
}
