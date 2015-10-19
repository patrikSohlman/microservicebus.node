/* 
* This script was originaly been created by microservicebus.com
*/
var chokidar = require('chokidar');
var fs = require('fs');
var path = require('path');
var linq = require('node-linq').LINQ;
var watcher;
var me;
var mkdirSync = function (path) {
    try {
        if(!fs.existsSync(path))
            fs.mkdirSync(path);
    } catch (e) {
        if (e.code != 'EEXIST') throw e;
    }
}
var mkdirpSync = function (dirpath) {
    var parts = dirpath.split(path.sep);
    for (var i = 1; i <= parts.length; i++) {
        var p = path.join.apply(null, parts.slice(0, i));
        mkdirSync(p);
    }
}
var exports = module.exports = {
    
    // The Start method is called from the Host. This is where you 
    // implement your code to fetch the data and submit the message
    // back to the host.
    Start : function () {
        try {
            me = this; // create reference to this in event handler
            var dir = this.GetPropertyValue('static', 'path');
            var createDirectory = this.GetPropertyValue('static', 'createDirectory');
            var filter = this.GetPropertyValue('static', 'filter');
            var scanFileForMimeType = this.GetPropertyValue('static', 'scanFileForMimeType');
            
            if (createDirectory && !fs.existsSync(dir)) {
                mkdirpSync(dir);
            }
            
            var searchPath = path.join(dir, filter);
            watcher = chokidar.watch(searchPath, {
                ignored: /[\/\\]\./, persistent: true
            });
            watcher.on('add', function (filePath) {
                try {
                    fs.open(filePath, 'r', function (err, fd) {
                        fs.fstat(fd, function (err, stats) {
                            var bufferSize = stats.size,
                                chunkSize = 512,
                                buffer = new Buffer(bufferSize),
                                bytesRead = 0;
                            
                            while (bytesRead < bufferSize) {
                                if ((bytesRead + chunkSize) > bufferSize) {
                                    chunkSize = (bufferSize - bytesRead);
                                }
                                fs.read(fd, buffer, bytesRead, chunkSize, bytesRead);
                                bytesRead += chunkSize;
                            }
                            fs.close(fd);
                            
                            var fileName = path.basename(filePath);
                            var extension =  path.extname(fileName);
                            
                            var varaiables = [
                                { Variable: '_fullPath', Type: 'String', Value: filePath },
                                { Variable: '_fileName', Type: 'String', Value: fileName },
                                { Variable: '_fileExtension', Type: 'String', Value: extension }
                                ];
                            var contentType = me.getContentType(filePath);
                            
                            var buf = null;
                            var msg = null;
                            
                            if (contentType == 'application/json') {
                                buf = new Buffer(buffer, 'base64');
                                msg = buf.toString('utf8');
                                
                                try {
                                    var obj = JSON.parse(msg);
                                    me.SubmitMessage(obj, contentType, varaiables);
                                }
                                catch (ex) {
                                    me.ThrowError(null,'00001', 'Unable to parse json object. ' + ex.message);
                                }
                            }
                            else if (contentType == 'application/xml' || contentType == 'text/plain') {
                                buf = new Buffer(buffer, 'base64');
                                msg = buf.toString('utf8');
                                me.SubmitMessage(msg, contentType, varaiables);
                            }
                            else {
                                me.SubmitMessage(buffer, contentType, varaiables);
                            }
                        });
                        
                        // Remove file
                        fs.unlinkSync(filePath);
                    });
                }
                catch (ex) {
                    console.log('Error in file watcher '.red + this.Name.red);
                    console.log(ex.message.red);
                    me.Error(me.Name, 00001, 'Error in file watcher. ' + ex.message);
                }
            });
        }
        catch (mainEx) {
            console.log('Error starting '.red + this.Name.red);
            me.Error(this.Name, 00001, 'Error starting '.red + this.Name.red + '. ' + mainEx.message);
        }
    },
    
    // The Stop method is called from the Host when the Host is 
    // either stopped or has updated integrations. 
    Stop : function () {
        watcher.close();
    },    
    
    Process : function (message, context) { },   
    
    getContentType: function (filePath) {
        var extension = path.extname(filePath);
        var extensions = [{ ext: ".3dm", type: "x-world/x-3dmf" }, { ext: ".3dmf", type: "x-world/x-3dmf" }, { ext: ".a", type: "application/octet-stream" }, { ext: ".aab", type: "application/x-authorware-bin" }, { ext: ".aam", type: "application/x-authorware-map" }, { ext: ".aas", type: "application/x-authorware-seg" }, { ext: ".abc", type: "text/vnd.abc" }, { ext: ".acgi", type: "text/html" }, { ext: ".afl", type: "video/animaflex" }, { ext: ".ai", type: "application/postscript" }, { ext: ".aif", type: "audio/aiff" }, { ext: ".aifc", type: "audio/aiff" }, { ext: ".aiff", type: "audio/aiff" }, { ext: ".aim", type: "application/x-aim" }, { ext: ".aip", type: "text/x-audiosoft-intra" }, { ext: ".ani", type: "application/x-navi-animation" }, { ext: ".aos", type: "application/x-nokia-9000-communicator-add-on-software" }, { ext: ".aps", type: "application/mime" }, { ext: ".arc", type: "application/octet-stream" }, { ext: ".arj", type: "application/arj" }, { ext: ".art", type: "image/x-jg" }, { ext: ".asf", type: "video/x-ms-asf" }, { ext: ".asm", type: "text/x-asm" }, { ext: ".asp", type: "text/asp" }, { ext: ".asx", type: "application/x-mplayer2" }, { ext: ".au", type: "audio/basic" }, { ext: ".avi", type: "video/avi" }, { ext: ".avs", type: "video/avs-video" }, { ext: ".bcpio", type: "application/x-bcpio" }, { ext: ".bin", type: "application/octet-stream" }, { ext: ".bm", type: "image/bmp" }, { ext: ".bmp", type: "image/bmp" }, { ext: ".boo", type: "application/book" }, { ext: ".book", type: "application/book" }, { ext: ".boz", type: "application/x-bzip2" }, { ext: ".bsh", type: "application/x-bsh" }, { ext: ".bz", type: "application/x-bzip" }, { ext: ".bz2", type: "application/x-bzip2" }, { ext: ".c", type: "text/plain" }, { ext: ".c++", type: "text/plain" }, { ext: ".cat", type: "application/vnd.ms-pki.seccat" }, { ext: ".cc", type: "text/plain" }, { ext: ".ccad", type: "application/clariscad" }, { ext: ".cco", type: "application/x-cocoa" }, { ext: ".cdf", type: "application/cdf" }, { ext: ".cer", type: "application/pkix-cert" }, { ext: ".cha", type: "application/x-chat" }, { ext: ".chat", type: "application/x-chat" }, { ext: ".class", type: "application/java" }, { ext: ".com", type: "application/octet-stream" }, { ext: ".conf", type: "text/plain" }, { ext: ".cpio", type: "application/x-cpio" }, { ext: ".cpp", type: "text/x-c" }, { ext: ".cpt", type: "application/x-cpt" }, { ext: ".crl", type: "application/pkcs-crl" }, { ext: ".css", type: "text/css" }, { ext: ".def", type: "text/plain" }, { ext: ".der", type: "application/x-x509-ca-cert" }, { ext: ".dif", type: "video/x-dv" }, { ext: ".dir", type: "application/x-director" }, { ext: ".dl", type: "video/dl" }, { ext: ".doc", type: "application/msword" }, { ext: ".dot", type: "application/msword" }, { ext: ".dp", type: "application/commonground" }, { ext: ".drw", type: "application/drafting" }, { ext: ".dump", type: "application/octet-stream" }, { ext: ".dv", type: "video/x-dv" }, { ext: ".dvi", type: "application/x-dvi" }, { ext: ".dwf", type: "drawing/x-dwf (old)" }, { ext: ".dwg", type: "application/acad" }, { ext: ".dxf", type: "application/dxf" }, { ext: ".eps", type: "application/postscript" }, { ext: ".es", type: "application/x-esrehber" }, { ext: ".etx", type: "text/x-setext" }, { ext: ".evy", type: "application/envoy" }, { ext: ".exe", type: "application/octet-stream" }, { ext: ".f", type: "text/plain" }, { ext: ".f90", type: "text/x-fortran" }, { ext: ".fdf", type: "application/vnd.fdf" }, { ext: ".fif", type: "image/fif" }, { ext: ".fli", type: "video/fli" }, { ext: ".for", type: "text/x-fortran" }, { ext: ".fpx", type: "image/vnd.fpx" }, { ext: ".g", type: "text/plain" }, { ext: ".g3", type: "image/g3fax" }, { ext: ".gif", type: "image/gif" }, { ext: ".gl", type: "video/gl" }, { ext: ".gsd", type: "audio/x-gsm" }, { ext: ".gtar", type: "application/x-gtar" }, { ext: ".gz", type: "application/x-compressed" }, { ext: ".h", type: "text/plain" }, { ext: ".help", type: "application/x-helpfile" }, { ext: ".hgl", type: "application/vnd.hp-hpgl" }, { ext: ".hh", type: "text/plain" }, { ext: ".hlp", type: "application/x-winhelp" }, { ext: ".htc", type: "text/x-component" }, { ext: ".htm", type: "text/html" }, { ext: ".html", type: "text/html" }, { ext: ".htmls", type: "text/html" }, { ext: ".htt", type: "text/webviewhtml" }, { ext: ".htx", type: "text/html" }, { ext: ".ice", type: "x-conference/x-cooltalk" }, { ext: ".ico", type: "image/x-icon" }, { ext: ".idc", type: "text/plain" }, { ext: ".ief", type: "image/ief" }, { ext: ".iefs", type: "image/ief" }, { ext: ".iges", type: "application/iges" }, { ext: ".igs", type: "application/iges" }, { ext: ".ima", type: "application/x-ima" }, { ext: ".imap", type: "application/x-httpd-imap" }, { ext: ".inf", type: "application/inf" }, { ext: ".ins", type: "application/x-internett-signup" }, { ext: ".ip", type: "application/x-ip2" }, { ext: ".isu", type: "video/x-isvideo" }, { ext: ".it", type: "audio/it" }, { ext: ".iv", type: "application/x-inventor" }, { ext: ".ivr", type: "i-world/i-vrml" }, { ext: ".ivy", type: "application/x-livescreen" }, { ext: ".jam", type: "audio/x-jam" }, { ext: ".jav", type: "text/plain" }, { ext: ".java", type: "text/plain" }, { ext: ".jcm", type: "application/x-java-commerce" }, { ext: ".jfif", type: "image/jpeg" }, { ext: ".jfif-tbnl", type: "image/jpeg" }, { ext: ".jpe", type: "image/jpeg" }, { ext: ".jpeg", type: "image/jpeg" }, { ext: ".jpg", type: "image/jpeg" }, { ext: ".jps", type: "image/x-jps" }, { ext: ".js", type: "application/x-javascript" }, { ext: ".json", type: "application/json" }, { ext: ".jut", type: "image/jutvision" }, { ext: ".kar", type: "audio/midi" }, { ext: ".ksh", type: "application/x-ksh" }, { ext: ".la", type: "audio/nspaudio" }, { ext: ".lam", type: "audio/x-liveaudio" }, { ext: ".latex", type: "application/x-latex" }, { ext: ".lha", type: "application/lha" }, { ext: ".lhx", type: "application/octet-stream" }, { ext: ".list", type: "text/plain" }, { ext: ".lma", type: "audio/nspaudio" }, { ext: ".log", type: "text/plain" }, { ext: ".lsp", type: "application/x-lisp" }, { ext: ".lst", type: "text/plain" }, { ext: ".lsx", type: "text/x-la-asf" }, { ext: ".ltx", type: "application/x-latex" }, { ext: ".lzh", type: "application/octet-stream" }, { ext: ".lzx", type: "application/lzx" }, { ext: ".m", type: "text/plain" }, { ext: ".m1v", type: "video/mpeg" }, { ext: ".m2a", type: "audio/mpeg" }, { ext: ".m2v", type: "video/mpeg" }, { ext: ".m3u", type: "audio/x-mpequrl" }, { ext: ".man", type: "application/x-troff-man" }, { ext: ".map", type: "application/x-navimap" }, { ext: ".mar", type: "text/plain" }, { ext: ".mbd", type: "application/mbedlet" }, { ext: ".mc$", type: "application/x-magic-cap-package-1.0" }, { ext: ".mcd", type: "application/mcad" }, { ext: ".mcf", type: "image/vasa" }, { ext: ".mcp", type: "application/netmc" }, { ext: ".me", type: "application/x-troff-me" }, { ext: ".mht", type: "message/rfc822" }, { ext: ".mhtml", type: "message/rfc822" }, { ext: ".mid", type: "audio/midi" }, { ext: ".midi", type: "audio/midi" }, { ext: ".mif", type: "application/x-frame" }, { ext: ".mime", type: "message/rfc822" }, { ext: ".mjf", type: "audio/x-vnd.audioexplosion.mjuicemediafile" }, { ext: ".mjpg", type: "video/x-motion-jpeg" }, { ext: ".mm", type: "application/base64" }, { ext: ".mme", type: "application/base64" }, { ext: ".mod", type: "audio/mod" }, { ext: ".moov", type: "video/quicktime" }, { ext: ".mov", type: "video/quicktime" }, { ext: ".movie", type: "video/x-sgi-movie" }, { ext: ".mp2", type: "audio/mpeg" }, { ext: ".mp3", type: "audio/mpeg3" }, { ext: ".mpa", type: "audio/mpeg" }, { ext: ".mpc", type: "application/x-project" }, { ext: ".mpe", type: "video/mpeg" }, { ext: ".mpeg", type: "video/mpeg" }, { ext: ".mpg", type: "video/mpeg" }, { ext: ".mpga", type: "audio/mpeg" }, { ext: ".mpp", type: "application/vnd.ms-project" }, { ext: ".mpt", type: "application/x-project" }, { ext: ".mpv", type: "application/x-project" }, { ext: ".mpx", type: "application/x-project" }, { ext: ".mrc", type: "application/marc" }, { ext: ".ms", type: "application/x-troff-ms" }, { ext: ".mv", type: "video/x-sgi-movie" }, { ext: ".my", type: "audio/make" }, { ext: ".mzz", type: "application/x-vnd.audioexplosion.mzz" }, { ext: ".nap", type: "image/naplps" }, { ext: ".naplps", type: "image/naplps" }, { ext: ".nc", type: "application/x-netcdf" }, { ext: ".ncm", type: "application/vnd.nokia.configuration-message" }, { ext: ".nif", type: "image/x-niff" }, { ext: ".niff", type: "image/x-niff" }, { ext: ".nix", type: "application/x-mix-transfer" }, { ext: ".nsc", type: "application/x-conference" }, { ext: ".nvd", type: "application/x-navidoc" }, { ext: ".o", type: "application/octet-stream" }, { ext: ".oda", type: "application/oda" }, { ext: ".omc", type: "application/x-omc" }, { ext: ".omcd", type: "application/x-omcdatamaker" }, { ext: ".omcr", type: "application/x-omcregerator" }, { ext: ".p", type: "text/x-pascal" }, { ext: ".p10", type: "application/pkcs10" }, { ext: ".p12", type: "application/pkcs-12" }, { ext: ".p7a", type: "application/x-pkcs7-signature" }, { ext: ".p7c", type: "application/pkcs7-mime" }, { ext: ".pas", type: "text/pascal" }, { ext: ".pbm", type: "image/x-portable-bitmap" }, { ext: ".pcl", type: "application/vnd.hp-pcl" }, { ext: ".pct", type: "image/x-pict" }, { ext: ".pcx", type: "image/x-pcx" }, { ext: ".pdf", type: "application/pdf" }, { ext: ".pfunk", type: "audio/make" }, { ext: ".pgm", type: "image/x-portable-graymap" }, { ext: ".pic", type: "image/pict" }, { ext: ".pict", type: "image/pict" }, { ext: ".pkg", type: "application/x-newton-compatible-pkg" }, { ext: ".pko", type: "application/vnd.ms-pki.pko" }, { ext: ".pl", type: "text/plain" }, { ext: ".plx", type: "application/x-pixclscript" }, { ext: ".pm", type: "image/x-xpixmap" }, { ext: ".png", type: "image/png" }, { ext: ".pnm", type: "application/x-portable-anymap" }, { ext: ".pot", type: "application/mspowerpoint" }, { ext: ".pov", type: "model/x-pov" }, { ext: ".ppa", type: "application/vnd.ms-powerpoint" }, { ext: ".ppm", type: "image/x-portable-pixmap" }, { ext: ".pps", type: "application/mspowerpoint" }, { ext: ".ppt", type: "application/mspowerpoint" }, { ext: ".ppz", type: "application/mspowerpoint" }, { ext: ".pre", type: "application/x-freelance" }, { ext: ".prt", type: "application/pro_eng" }, { ext: ".ps", type: "application/postscript" }, { ext: ".psd", type: "application/octet-stream" }, { ext: ".pvu", type: "paleovu/x-pv" }, { ext: ".pwz", type: "application/vnd.ms-powerpoint" }, { ext: ".py", type: "text/x-script.phyton" }, { ext: ".pyc", type: "applicaiton/x-bytecode.python" }, { ext: ".qcp", type: "audio/vnd.qcelp" }, { ext: ".qd3", type: "x-world/x-3dmf" }, { ext: ".qd3d", type: "x-world/x-3dmf" }, { ext: ".qif", type: "image/x-quicktime" }, { ext: ".qt", type: "video/quicktime" }, { ext: ".qtc", type: "video/x-qtc" }, { ext: ".qti", type: "image/x-quicktime" }, { ext: ".qtif", type: "image/x-quicktime" }, { ext: ".ra", type: "audio/x-pn-realaudio" }, { ext: ".ram", type: "audio/x-pn-realaudio" }, { ext: ".ras", type: "application/x-cmu-raster" }, { ext: ".rast", type: "image/cmu-raster" }, { ext: ".rexx", type: "text/x-script.rexx" }, { ext: ".rf", type: "image/vnd.rn-realflash" }, { ext: ".rgb", type: "image/x-rgb" }, { ext: ".rm", type: "application/vnd.rn-realmedia" }, { ext: ".rmi", type: "audio/mid" }, { ext: ".rmm", type: "audio/x-pn-realaudio" }, { ext: ".rmp", type: "audio/x-pn-realaudio" }, { ext: ".rng", type: "application/ringing-tones" }, { ext: ".rnx", type: "application/vnd.rn-realplayer" }, { ext: ".roff", type: "application/x-troff" }, { ext: ".rp", type: "image/vnd.rn-realpix" }, { ext: ".rpm", type: "audio/x-pn-realaudio-plugin" }, { ext: ".rt", type: "text/richtext" }, { ext: ".rtf", type: "text/richtext" }, { ext: ".rtx", type: "application/rtf" }, { ext: ".rv", type: "video/vnd.rn-realvideo" }, { ext: ".s", type: "text/x-asm" }, { ext: ".s3m", type: "audio/s3m" }, { ext: ".saveme", type: "application/octet-stream" }, { ext: ".sbk", type: "application/x-tbook" }, { ext: ".scm", type: "application/x-lotusscreencam" }, { ext: ".sdml", type: "text/plain" }, { ext: ".sdp", type: "application/sdp" }, { ext: ".sdr", type: "application/sounder" }, { ext: ".sea", type: "application/sea" }, { ext: ".set", type: "application/set" }, { ext: ".sgm", type: "text/sgml" }, { ext: ".sgml", type: "text/sgml" }, { ext: ".sh", type: "application/x-bsh" }, { ext: ".shtml", type: "text/html" }, { ext: ".sid", type: "audio/x-psid" }, { ext: ".sit", type: "application/x-sit" }, { ext: ".skd", type: "application/x-koan" }, { ext: ".skm", type: "application/x-koan" }, { ext: ".skp", type: "application/x-koan" }, { ext: ".skt", type: "application/x-koan" }, { ext: ".sl", type: "application/x-seelogo" }, { ext: ".smi", type: "application/smil" }, { ext: ".smil", type: "application/smil" }, { ext: ".snd", type: "audio/basic" }, { ext: ".sol", type: "application/solids" }, { ext: ".spc", type: "application/x-pkcs7-certificates" }, { ext: ".spl", type: "application/futuresplash" }, { ext: ".spr", type: "application/x-sprite" }, { ext: ".sprite", type: "application/x-sprite" }, { ext: ".src", type: "application/x-wais-source" }, { ext: ".ssi", type: "text/x-server-parsed-html" }, { ext: ".ssm", type: "application/streamingmedia" }, { ext: ".sst", type: "application/vnd.ms-pki.certstore" }, { ext: ".step", type: "application/step" }, { ext: ".stl", type: "application/sla" }, { ext: ".stp", type: "application/step" }, { ext: ".sv4cpio", type: "application/x-sv4cpio" }, { ext: ".sv4crc", type: "application/x-sv4crc" }, { ext: ".svf", type: "image/vnd.dwg" }, { ext: ".svr", type: "application/x-world" }, { ext: ".swf", type: "application/x-shockwave-flash" }, { ext: ".t", type: "application/x-troff" }, { ext: ".talk", type: "text/x-speech" }, { ext: ".tar", type: "application/x-tar" }, { ext: ".tbk", type: "application/toolbook" }, { ext: ".tcl", type: "application/x-tcl" }, { ext: ".tcsh", type: "text/x-script.tcsh" }, { ext: ".tex", type: "application/x-tex" }, { ext: ".texi", type: "application/x-texinfo" }, { ext: ".texinfo", type: "application/x-texinfo" }, { ext: ".text", type: "text/plain" }, { ext: ".tgz", type: "application/x-compressed" }, { ext: ".tif", type: "image/tiff" }, { ext: ".tr", type: "application/x-troff" }, { ext: ".tsi", type: "audio/tsp-audio" }, { ext: ".tsp", type: "audio/tsplayer" }, { ext: ".tsv", type: "text/tab-separated-values" }, { ext: ".turbot", type: "image/florian" }, { ext: ".txt", type: "text/plain" }, { ext: ".uil", type: "text/x-uil" }, { ext: ".uni", type: "text/uri-list" }, { ext: ".unis", type: "text/uri-list" }, { ext: ".unv", type: "application/i-deas" }, { ext: ".uri", type: "text/uri-list" }, { ext: ".uris", type: "text/uri-list" }, { ext: ".ustar", type: "application/x-ustar" }, { ext: ".uu", type: "application/octet-stream" }, { ext: ".vcd", type: "application/x-cdlink" }, { ext: ".vcs", type: "text/x-vcalendar" }, { ext: ".vda", type: "application/vda" }, { ext: ".vdo", type: "video/vdo" }, { ext: ".vew", type: "application/groupwise" }, { ext: ".viv", type: "video/vivo" }, { ext: ".vivo", type: "video/vivo" }, { ext: ".vmd", type: "application/vocaltec-media-desc" }, { ext: ".vmf", type: "application/vocaltec-media-file" }, { ext: ".voc", type: "audio/voc" }, { ext: ".vos", type: "video/vosaic" }, { ext: ".vox", type: "audio/voxware" }, { ext: ".vqe", type: "audio/x-twinvq-plugin" }, { ext: ".vqf", type: "audio/x-twinvq" }, { ext: ".vql", type: "audio/x-twinvq-plugin" }, { ext: ".vrml", type: "application/x-vrml" }, { ext: ".vrt", type: "x-world/x-vrt" }, { ext: ".vsd", type: "application/x-visio" }, { ext: ".vst", type: "application/x-visio" }, { ext: ".vsw", type: "application/x-visio" }, { ext: ".w60", type: "application/wordperfect6.0" }, { ext: ".w61", type: "application/wordperfect6.1" }, { ext: ".w6w", type: "application/msword" }, { ext: ".wav", type: "audio/wav" }, { ext: ".wb1", type: "application/x-qpro" }, { ext: ".wbmp", type: "image/vnd.wap.wbmp" }, { ext: ".web", type: "application/vnd.xara" }, { ext: ".wiz", type: "application/msword" }, { ext: ".wk1", type: "application/x-123" }, { ext: ".wmf", type: "windows/metafile" }, { ext: ".wml", type: "text/vnd.wap.wml" }, { ext: ".wmlc", type: "application/vnd.wap.wmlc" }, { ext: ".wmls", type: "text/vnd.wap.wmlscript" }, { ext: ".wmlsc", type: "application/vnd.wap.wmlscriptc" }, { ext: ".word", type: "application/msword" }, { ext: ".wp", type: "application/wordperfect" }, { ext: ".wp5", type: "application/wordperfect" }, { ext: ".wp6", type: "application/wordperfect" }, { ext: ".wpd", type: "application/wordperfect" }, { ext: ".wq1", type: "application/x-lotus" }, { ext: ".wri", type: "application/mswrite" }, { ext: ".wrl", type: "application/x-world" }, { ext: ".wrz", type: "model/vrml" }, { ext: ".wsc", type: "text/scriplet" }, { ext: ".wsrc", type: "application/x-wais-source" }, { ext: ".wtk", type: "application/x-wintalk" }, { ext: ".xbm", type: "image/x-xbitmap" }, { ext: ".xdr", type: "video/x-amt-demorun" }, { ext: ".xgz", type: "xgl/drawing" }, { ext: ".xif", type: "image/vnd.xiff" }, { ext: ".xl", type: "application/excel" }, { ext: ".xla", type: "application/excel" }, { ext: ".xlb", type: "application/excel" }, { ext: ".xlc", type: "application/excel" }, { ext: ".xld", type: "application/excel" }, { ext: ".xlk", type: "application/excel" }, { ext: ".xll", type: "application/excel" }, { ext: ".xlm", type: "application/excel" }, { ext: ".xls", type: "application/excel" }, { ext: ".xlt", type: "application/excel" }, { ext: ".xlv", type: "application/excel" }, { ext: ".xlw", type: "application/excel" }, { ext: ".xm", type: "audio/xm" }, { ext: ".xml", type: "application/xml" }, { ext: ".xmz", type: "xgl/movie" }, { ext: ".xpix", type: "application/x-vnd.ls-xpix" }, { ext: ".xpm", type: "image/x-xpixmap" }, { ext: ".x-png", type: "image/png" }, { ext: ".xsr", type: "video/x-amt-showrun" }, { ext: ".xwd", type: "image/x-xwd" }, { ext: ".xyz", type: "chemical/x-pdb" }, { ext: ".z", type: "application/x-compress" }, { ext: ".zip", type: "application/x-compressed" }, { ext: ".zoo", type: "application/octet-stream" }, { ext: ".zsh", type: "text/x-script.zsh" }];
        var contentType = new linq(extensions).First(function (c) { return c.ext === extension; });
        return contentType.type;
    }, 
};
