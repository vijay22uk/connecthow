(function () {
  'use strict';
  var port = process.env.PORT || 8080;
var express = require('express');
var path = require('path');
var fs = require('fs');
var bodyParser = require("body-parser");
var socketHelper = require('./modules/socket');
var mongoDBConnectionString = "mongodb://localhost/VJ";
var app = express();
 app.use(bodyParser.json());
 app.use(bodyParser.urlencoded({ extended: true}));
 app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');
var db = require('./modules/dbutil');
var options = {
    key: fs.readFileSync('server/cert/private.pem'),
    cert: fs.readFileSync('server/cert/public.pem')
};
var http = require('https').Server(options,app);
var io = require('socket.io')(http);
app.use(express.static('./application/public'));
app.get('/', function(req, res){
   res.render('index', { message: "welcome" });
});

app.post('/go', function (req, res, next) {
    var email = req.body.emailid;
    var classRoom = req.body.classroom;
    var join = req.body.optradio;
    console.log(email ,classRoom );
    res.render('classroom', {  });
    
});

app.get('/classroom/:classroom/:emailid', function (req, res, next) {
    var email = req.params.emailid;
    var classRoom = req.params.classroom;
    res.render('classroom', {emailid:email,classRoom:classRoom  });
    
});




// routes 



socketHelper(io);
// io.on('connection', function(socket){
//   console.log('a user connected');
//   socket.on('disconnect', function(){
//     console.log('user disconnected');
//   });
//   socket.on('message', function(msg){
//     io.emit('message', msg);
//   });
// });

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