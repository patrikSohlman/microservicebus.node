var splitOn;
var batchId;
 
var exports = module.exports = {
    
    Start : function () {
        splitOn = this.GetPropertyValue('static', 'splitOn');
        batchId = this.GetPropertyValue('static', 'batchId');
    },
    Stop : function () {},    
    
    // The Process method is called from the host as it receives 
    // messages from the hub. The [messasge] parameter is a JSON 
    // object (the payload) and the [context] parameter is a 
    // value/pair object with parameters provided by the hub.
    Process : function (payload, context) {
        try {
            if (context.ContentType != 'application/json') {
                this.Error(this.Name, '00001', 'Unsupported content type (' + context.ContentType + ')');
                return;
            }
            
            if (typeof payload != 'object')
                payload = JSON.parse(payload);
            
            // Add variables
            var varialbesString = '';
            context.Variables.forEach(function (variable) {
                switch (variable.Type) {
                    case 'String':
                    case 'DateTime':
                        varialbesString += 'var ' + variable.Variable + ' = ' + "'" + variable.Value + "';\n"
                        break;
                    case 'Number':
                    case 'Decimal':
                        varialbesString += 'var ' + variable.Variable + ' = ' + variable.Value + ";\n"
                        break;
                    case 'Message':
                        var objString = JSON.stringify(variable.Value);
                        varialbesString += 'var ' + variable.Variable + ' = ' + objString + ";\n"
                        break;
                    default:
                        break;
                }
            });
            
            var script = 'var _splitResult = ' + splitOn;
            var expression = 'var message =' + JSON.stringify(payload) + ';\n' + varialbesString + ';\n' + script;
            
            eval(expression);
            
            var batchLength = _splitResult.length;
            var bId;
            if (batchId != null && batchId != '') {
                bId = this.ParseString(_batchId, message, context);
                context.Variables.push({ Variable: '_batchId', Type: 'String', Value: bId });
            }
            context.Variables.push({ Variable: '_batchLength', Type: 'String', Value: batchLength });
            
            for (var n in _splitResult) {
                this.SubmitResponseMessage(_splitResult[n], context, 'application/json');
            }
            
            this.Debug('After: ' + JSON.stringify(message));
        }
        catch (error) { 
            this.Error(this.Name, '00001', error);
        }
    },       
}
