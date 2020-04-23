(function () {
    'use strict';
    var port = process.env.PORT || 8080;
    var express = require('express');
    var path = require('path');
    var fs = require('fs');
    var bodyParser = require("body-parser");
    var socketHelper = require('./modules/socket');
    var mongoDBConnectionString = process.env.MONGODB_URI||"mongodb://localhost/VJ" ;
    var ACCOUNT_SID = "AC5f42bb216296d8a49597c64ba6a16326";
    var AUTH_TOKEN = "765f8cac248d09b1a5dff812b1c3caa8";
    var twilio = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);
    var routes = require('./routes/tasks');
    var app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');
    var db = require('./modules/dbutil');
    var http = require('http').Server(app); // http
    var io = require('socket.io')(http);
    
    var resArray = ["stun.l.google.com:19302",
"stun1.l.google.com:19302",
"stun2.l.google.com:19302",
"stun3.l.google.com:19302",
"stun4.l.google.com:19302",
"stun.ekiga.net",
"stun.ideasip.com",
"stun.rixtelecom.se",
"stun.schlund.de",
"stun.voiparound.com",
"stun.voipbuster.com",
"stun.voxgratia.org"]
    
    app.use(express.static('./application/public'));
    app.use('/tasks', routes);
    app.get('/', function (req, res) {
        res.render('index', { message: "welcome" });
    });

    app.post('/go', function (req, res, next) {
        var email = req.body.emailid;
        var classRoom = req.body.classroom;
        var join = req.body.optradio;
        res.render('classroom', {});

    });

    app.get('/classroom/:classroom/:emailid', function (req, res, next) {
        var email = req.params.emailid;
        var classRoom = req.params.classroom;
        res.render('classroom', { emailid: email, classRoom: classRoom });

    });
    app.get('/dashboard', function (req, res, next) {
        var email = req.params.emailid;
        var classRoom = req.params.classroom;
        res.render('dashboard', {});

    });
    // twilio turn server
    app.get('/twilio', function (req, res, next) {
        twilio.tokens.create({}, function (err, response) {
            if (err) {
                res.status(500).send({ "success": false, error: err });
            } else {
                //console.log(response);
                res.json({ "success": true, s: 200, "iceServers": resArray });
            }
        });
    });

    socketHelper(io);
    db.connect(mongoDBConnectionString, function (err) {
        if (err) {
            http.listen(port, function () {
                console.log('W/o DB  listening on :%d', port);
            });
        } else {
            http.listen(port, function () {
                console.log('DB http listening on :%d', port);
            });
        }
    });
})();
