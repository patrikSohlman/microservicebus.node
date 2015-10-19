
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
        
        
         this.AddNpmPackage('nodemailer', true, function (err) {
            if (err == null || err == "") {
                nodemailer = require('nodemailer');
                
                this.AddNpmPackage('nodemailer-smtp-transport', true, function (err) {
                    if (err == null || err == "") {
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
                    else {
                        this.Error(this.Name, '00001', 'Unable to start SMTP outbound service');
                        this.Error(this.Name, '00001', err);
                        return;
                    }
                });
            }
            else {
                this.Error(this.Name, '00001', 'Unable to start SMTP outbound service');
                this.Error(this.Name, '00001', err);
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
        var payload = JSON.stringify(message);
        var from = this.GetPropertyValue('static', 'from');
        var to = this.GetPropertyValue('static', 'to');
        var subject = this.GetPropertyValue('static', 'subject');
        var body = this.GetPropertyValue('static', 'body');
        var isHtml = this.GetPropertyValue('static', 'isHtml');
        var attachMessage = this.GetPropertyValue('static', 'attachMessage');
        
        var mailOptions = {
            from: from, // sender address
            to: to, // list of receivers
            subject: subject, // Subject line
        };
        if(isHtml)
            mailOptions.html = body;
        else
            mailOptions.text = body;
        // Send Email
       transporter.sendMail(mailOptions, function(error, info){
            if(error){
                me.Error(me.Name, '00001', error);
            }
            me.Debug('Message sent: ' + info.response);
        
        });
    },    
}
