
var MongoClient;
var server;
var port;
var db;
var collection;

var username;
var password;

var url;
var me;
var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        me = this;
        server = this.GetPropertyValue('static', 'server');
        port = this.GetPropertyValue('static', 'port');
        db = this.GetPropertyValue('static', 'db');
        
        username = this.GetPropertyValue('security', 'userName');
        password = this.GetPropertyValue('security', 'password');
        
        url = 'mongodb://' + server + ':' + port + '/' + db;
        this.AddNpmPackage('mongodb', true, function (err) {
            if (err == null || err == "") {
                MongoClient = require('mongodb').MongoClient;
                
                varaiables = [
                    { "server": server },
                    { "port": port },
                    { "database": db },
                    { "collection": collection },
                ];
               
            }
            else {
                me.ThrowError(null, '00001', 'Unable to start MongoDb inbound service');
                me.ThrowError(null, '00001', err.message);
                return;
            }
        });
    },
    
    // The Stop method is called from the Host when the Host is 
    // either stopped or has updated integrations. 
    Stop : function () { },    
    
    // The Process method is called from the host as it receives 
    // messages from the hub. The [messasge] parameter is a JSON 
    // object (the payload) and the [context] parameter is a 
    // value/pair object with parameters provided by the hub.
    Process : function (message, context) {
        try {
            if(!MongoClient){
                this.Debug('MongoClient not ready yet...');    
                return;
            }
            
            MongoClient.connect(url, function (err, db) {
                
                me.Debug('collection:' + message.collection + ' type:' + message.type);
                var col = db.collection(message.collection);
                switch (message.type) {
                    case 'SELECT':
                        me.findDocuments(db, col, message.query, function (err, docs) {
                            if (err) {
                                me.ThrowError(context, '00003', 'Unable to select documents.' + err.message);
                                return;
                            }
                            me.SubmitResponseMessage(docs, context, 'application/json');
                        });
                        break;
                    case 'INSERT':
                        me.insertDocument(db, col, message.data, function (err, insertedCount) {
                            if (err) {
                                me.ThrowError(context, '00004', 'Unable to insert documents.' + err.message);
                                return;
                            }
                            me.SubmitResponseMessage({ "count": insertedCount }, context, 'application/json');
                        });
                        break;
                    case 'UPDATE':
                        me.updateDocument(db, col, message.query, message.values, function (err, modifiedCount) {
                            if (err) {
                                me.ThrowError(context, '00005', 'Unable to update documents.' + err.message);
                                return;
                            }
                            me.SubmitResponseMessage({ "count": modifiedCount }, context, 'application/json');
                        });
                        break;
                    case 'DELETE':
                        me.deleteDocument(db, col, message.query, function (err, deletedCount) {
                            if (err) {
                                me.ThrowError(context, '00005', 'Unable to delete documents.' + err.message);
                                return;
                            }
                            me.SubmitResponseMessage({ "count": deletedCount }, context, 'application/json');
                        });
                        break;
                    default:
                        me.ThrowError(context, '00002', 'Unsupported type');
                }
            });
        }
        catch (err) {
            this.ThrowError(context , '00001', "Unable to execute NOSQL statement. " + err.message);
        }
    },   
    
    findDocuments : function (db, col, query, callback) {
        // Get the documents collection 
        // Find some documents 
        col.find(query).toArray(function (err, docs) {
            callback(err, docs);
        });
    },
    insertDocument : function (db, col, data, callback) {
        col.insert(data, function (err, ret) {
            var insertedCount = err == null ? ret.insertedCount : 0;
            callback(err, insertedCount);
        });
    },
    updateDocument : function (db, col, query, values, callback) {
        col.update(query, values, null, function (err, ret) {
            var modifiedCount = err == null ? ret.modifiedCount : 0;
            callback(err, modifiedCount);
        });
    },
    deleteDocument : function (db, col, query, callback) {
        col.delete(query, null, function (err, ret) {
            var deletedCount = err == null ? ret.deletedCount : 0;
            callback(err, deletedCount);
        });
    }
};
