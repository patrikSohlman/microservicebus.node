
var me, nodemailer,smtpTransport, transporter;

var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        me = this;
        var smtpServer = this.GetPropertyValue('security', 'smtpServer');
        var port = this.GetPropertyValue('security', 'port');
        var userName = this.GetPropertyValue('security', 'userName');
        var password = this.GetPropertyValue('security', 'password');
        
        this.AddNpmPackage('nodemailer,mailcomposer,nodemailer-smtp-transport,nodemailer-direct-transport,needle', true, function(err){
            if(err == null || err == ''){
                nodemailer = require('nodemailer');
                smtpTransport = require('nodemailer-smtp-transport');
                transporter = nodemailer.createTransport(smtpTransport({
                    host: smtpServer,
                    port: port,
                    auth: {
                        user: userName,
                        pass: password
                    }
                }));
            }
            else{
                this.ThrowError(null, '00001', 'Unable to install the nodemailer npm package');
                return;
            }
        });
        
    },

    Stop : function () {},    
    
    // The Process method is called from the host as it receives 
    // messages from the hub. The [messasge] parameter is a JSON 
    // object (the payload) and the [context] parameter is a 
    // value/pair object with parameters provided by the hub.
    Process : function (message, context) {
        try{
            
            if(!nodemailer || !smtpTransport || !transporter){
                this.Debug(this.Name + " is not ready yet. Installing packages...");
            }
            
            me.Debug('Send mail started');
            payload = message;
            
            
            if(context.ContentType == 'application/json')
                payload = JSON.stringify(message);
                
            var from = this.GetPropertyValue('static', 'from');
            var to = this.GetPropertyValue('static', 'to');
            var subject = this.GetPropertyValue('static', 'subject');
            var body = this.GetPropertyValue('static', 'body');
            var isHtml = this.GetPropertyValue('static', 'isHtml');
            var attachMessage = this.GetPropertyValue('static', 'attachMessage');
            
            // Parse content
            from = this.ParseString(from, message, context);
            to = this.ParseString(to, message, context);
            subject = this.ParseString(subject, message, context);
            body = this.ParseString(body, message, context);

            var mailOptions = {
                from: from, // sender address
                to: to, // list of receivers
                subject: subject, // Subject line
            };
            
            if(isHtml)
                mailOptions.html = body;
            else
                mailOptions.text = body;
            
            if (attachMessage) {
                var attachment = { 
                    filename: 'attachment.txt', 
                    content: payload
                };
                
                mailOptions.attachments = [attachment];
            }
    
            // Send Email
           transporter.sendMail(mailOptions, function(error, info){
                if(error){
                    me.ThrowError(context, '00001', 'Unable to send email. ' + error);
                }
                me.Debug('Message sent: ' + info.response);
            
            });
        }
        catch(err){
            me.ThrowError(context, '00002', 'Unable to send email. ' + error);
        }
    },    
}
