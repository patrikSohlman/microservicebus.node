var xml2js;

var exports = module.exports = {
    
    Start : function () {
        this.AddNpmPackage('xml2js', true, function(err){
            if(err == null || err == ""){
               xml2js = require('xml2js');
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
        if(context.ContentType != 'application/xml'){
            this.Error(this.Name, '00001', 'Unsupported content type. Must be application/xml')
            return;
        }
        
        xml2js = require('xml2js')
        
        var error;
        var obj;
        xml2js.parseString(payload, function (err, result) {
            if (err) {
                error=err;
            }
            obj = result;
        });
        if(error)
            this.Error(this.Name, '00001', error);
        else
            this.SubmitResponseMessage(obj, context, 'application/json');
        
        
    },    
}
