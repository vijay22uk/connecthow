(function () {
    'use strict';
    var port = process.env.PORT || 8080;
    var express = require('express');
    var path = require('path');
    var fs = require('fs');
    var bodyParser = require("body-parser");
    var socketHelper = require('./modules/socket');
    var mongoDBConnectionString = "mongodb://localhost/VJ";
    var ACCOUNT_SID = "AC5f42bb216296d8a49597c64ba6a16326";
    var AUTH_TOKEN = "765f8cac248d09b1a5dff812b1c3caa8";
    var twilio = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);
    var app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');
    var db = require('./modules/dbutil');
    var options = {
        key: fs.readFileSync('server/cert/private.pem'),
        cert: fs.readFileSync('server/cert/public.pem')
    };
   // var http = require('https').Server(options, app); // https
    var http = require('http').Server(app); // http
    var io = require('socket.io')(http);
    app.use(express.static('./application/public'));
    app.get('/', function (req, res) {
        res.render('index', { message: "welcome" });
    });

    app.post('/go', function (req, res, next) {
        var email = req.body.emailid;
        var classRoom = req.body.classroom;
        var join = req.body.optradio;
        console.log(email, classRoom);
        res.render('classroom', {});

    });

    app.get('/classroom/:classroom/:emailid', function (req, res, next) {
        var email = req.params.emailid;
        var classRoom = req.params.classroom;
        res.render('classroom', { emailid: email, classRoom: classRoom });

    });
   // twilio turn server
   app.get('/twilio', function (req, res, next) {
    twilio.tokens.create({}, function (err, response) {
        if (err) {
            res.status(500).send({ "success": false, error: err });
        } else {
            //console.log(response);
            res.json({ "success": true, s: 200, "iceServers": response.ice_servers });
        }
    });
});

    socketHelper(io);
    http.listen(port, function () {
        console.log('https  listening on :%d', port);
    });
    //console.log("db ::" + mongoDBConnectionString);
    //db.connect(mongoDBConnectionString, function (err) {
    //     if (err) {
    //         console.log('Unable to connect to Mongo.');
    //         process.exit(1)
    //     } else {
    //         http.listen(port, function () {
    //             console.log('https  listening on :%d', port);
    //         });
    //     }
    // });

})();