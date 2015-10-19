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
        if(context.ContentType != 'application/json'){
            this.Error(this.Name,'00001','Unsupported content type (' + context.ContentType + ')');
            return;
        }
        
        if(typeof payload != 'object')
            payload = JSON.parse(payload);
            
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
    
        var expression = 'var message =' + JSON.stringify(payload) + ';\n' + varialbesString + ';\n' + script;
        
        eval(expression);
        this.SubmitResponseMessage(message, context, 'application/json');
        this.Debug('After: '+ JSON.stringify(message));
    },    
}
