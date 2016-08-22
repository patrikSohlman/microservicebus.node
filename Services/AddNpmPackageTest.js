
var exports = module.exports = {
    
    Start : function () {
     this.AddNpmPackage('colors', true, function(err){
         if(err == null || err == ''){
             packageVariable = require('colors');
         }
         else{
             this.ThrowError(null, '00001', 'Unable to install the colors npm package');
             return;
         }
     });
    },
    Stop : function () {
        this.ThrowError(null, '1', 'dummy');
        
    },
    Process : function (message, context) {
        var dummy = this.GetPropertyValue('static', 'dummy');
        dummy = this.ParseString(dummy, message, context);
        
        var userName = this.GetPropertyValue('security', 'userName');
        userName = this.ParseString(userName, message, context);
        
        var host = this.GetPropertyValue('general', 'host');
        
    },
};
