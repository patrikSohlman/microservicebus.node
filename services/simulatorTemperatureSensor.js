/* 
* This script was originaly been created by microservicebus.com
*/
var me;
var timerEvent;
var interval;
var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        me = this;
        interval = this.GetPropertyValue('static', 'interval');
        timerEvent = setInterval(function () {
            me.Run();
            
        }, interval * 1000);
        
        setTimeout(function() {
            me.Run();    
        }, 3000);   
        
    },
    
    // The Stop method is called from the Host when the Host is 
    // either stopped or has updated integrations. 
    Stop : function () {
        clearInterval(timerEvent);
        this.Debug('Simulator stopped');
    },    
    
    Process : function (message, context) { },   
    Run : function (){
        var varaiables = [];
            var msg = {
                source: me.Name,
                temp: Math.floor(Math.random() * 30),
                dateTime : new Date(),
                unit: "C"
            };
        me.Debug("Submitting message..." + msg.temp + " C"); 
        me.SubmitMessage(msg, 'application/json', varaiables);
    },
};
