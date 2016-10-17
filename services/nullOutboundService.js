
var serializeMessage;
var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        serializeMessage = this.GetPropertyValue('static', 'serializeMessage') === true;
    },

    Stop : function () {},    
    
   Process : function (message, context) {
        if(serializeMessage)
            this.Debug(JSON.stringify(message));
        else
            this.Debug("Received message.");// + JSON.stringify(message));
       
       this.Done(context, this.Name);
   },    
}
