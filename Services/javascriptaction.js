var script;
 
var exports = module.exports = {
    
    Start : function () {
        script = this.GetPropertyValue('static', 'script');
    },
    Stop : function () {},    
    
    // The Process method is called from the host as it receives 
    // messages from the hub. The [messasge] parameter is a JSON 
    // object (the payload) and the [context] parameter is a 
    // value/pair object with parameters provided by the hub.
    Process : function (payload, context) {
        this.Debug('JavaScript started');
        if(context.ContentType != 'application/json'){
            this.ThrowError(null,'00001', 'Unsupported content type (' + context.ContentType + ')');
            return;
        }
        try{
            // Add variables
            var varialbesString = '';
            
                
            context.Variables.forEach(function (variable){
                switch (variable.Type) {
                    case 'String':
                    case 'DateTime':
                        varialbesString += 'var ' + variable.Variable + ' = ' + "'" + variable.Value + "';\n"
                        break;
                    case 'Number':
                    case 'Decimal':
                        varialbesString += 'var ' + variable.Variable + ' = '  + variable.Value + ";\n"
                        break;
                    case 'Message':
                        var objString = JSON.stringify(variable.Value);
                        varialbesString += 'var ' + variable.Variable + ' = ' + objString + ";\n"
                        break;
                    default:
                        break;
                }
            });
            var message;
            var expression = 'message =' + JSON.stringify(payload) + ';\n' + varialbesString + ';\n' + script + "\n";
            
            // Read context variables back to the context
            for (var i = 0; i < context.Variables.length; i++) {
                var variable = context.Variables[i];
                expression += 'context.Variables['+i+'].Value  = ' + variable.Variable + ";\n"
            }
            
            eval(expression);
            
            
            this.SubmitResponseMessage(message, context, 'application/json');
            this.Debug('JavaScript completed');
        
        }
        catch(err){
            this.ThrowError(context ,'00001', "Unable to evaluate script. " + err.message);
        }
    },    
}
