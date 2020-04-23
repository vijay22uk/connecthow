(function () {
    'use strict';
    var port = process.env.PORT || 8080;
    var express = require('express');
    var path = require('path');
    var fs = require('fs');
    var bodyParser = require("body-parser");
    var socketHelper = require('./modules/socket');
    var mongoDBConnectionString = process.env.MONGODB_URI||"mongodb://localhost/VJ" ;
    var routes = require('./routes/tasks');
    var app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');
    var db = require('./modules/dbutil');
    var http = require('http').Server(app); // http
    var io = require('socket.io')(http);
    
    var resArray = [
        { url: "stun:global.stun.twilio.com:3478?transport=udp" },
        { url: 'stun:stun.l.google.com:19302' },
        {
            url: 'turn:global.turn.twilio.com:3478?transport=udp',
            credential: 'HtboCOTcJTqj3O11vRVgSxb1CI3WChCjN54YyKfInYY=',
            username: '32cfa6f77aa939179a701e0eb4b540bd37d916a8168c45b948dd9969b0ad23b8'
        },
        {
            url: 'urn:global.turn.twilio.com:3478?transport=tcp',
            credential: 'HtboCOTcJTqj3O11vRVgSxb1CI3WChCjN54YyKfInYY=',
            username: '32cfa6f77aa939179a701e0eb4b540bd37d916a8168c45b948dd9969b0ad23b8'
        },
        { 
          credential:"HtboCOTcJTqj3O11vRVgSxb1CI3WChCjN54YyKfInYY=",
          url:"turn:global.turn.twilio.com:443?transport=tcp",
          username:"32cfa6f77aa939179a701e0eb4b540bd37d916a8168c45b948dd9969b0ad23b8"
        },
        {
            url: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com'
        }];
    
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
        res.json({ "success": true, s: 200, "iceServers": resArray });
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
