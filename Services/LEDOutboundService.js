
var five;// = require("johnny-five");
var board, controller, pin, action;
var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        var me = this;
        
        controller = this.GetPropertyValue('static', 'controller');
        pin = this.GetPropertyValue('static', 'pin');
        address = this.GetPropertyValue('static', 'address');
        action = this.GetPropertyValue('static', 'action');
        
        this.AddNpmPackage('johnny-five', true, function(err){
            if(err == null || err == ""){
                five  = require('johnny-five');
                
            }
            else{
                this.Error(this.Name, '00001', 'Unable to start LED outbound service');
                this.Error(this.Name, '00001', err);
                return;
            }
        });
        board = new five.Board(); 
        board.on("ready", function() {
            var led = new five.Led({
                controller: controller,
                pin: pin
            });
        });
    },

    Stop : function () {
        board = null;
        led = null;
    },    
    
   Process : function (message, context) {
       switch(action){
           case 'ON':
               led.on();
            break;
           case 'OFF':
               led.off();
            break;
           case 'TOGGLE':
               led.toggle();
            break;
           case 'STROBE':
               led.strobe(500);
            break;
           case 'BLINK':
               led.blink(500);
            break;
           default:
           this.Error(this.Name, '00001', 'Unsupported LED action');
            break;
           
           
       }
       
   },    
}
