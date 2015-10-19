/* 
 * Service template for node.js
 * 
 * To use this template, simply add your code in Start and Stop method

*/

 
var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {

    },

    // The Stop method is called from the Host when the Host is 
    // either stopped or has updated integrations. 
    Stop : function () {
    },    
    
    // The Process method is called from the host as it receives 
    // messages from the hub. The [messasge] parameter is a JSON 
    // object (the payload) and the [context] parameter is a 
    // value/pair object with parameters provided by the hub.
    Process : function (message, context) {
    },    
}
