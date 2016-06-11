(function () {
  'use strict';
  var port = 8080;
var app = require('express')();
var express = require('express');
var path = require('path');
var fs = require('fs');
var mongoDBConnectionString = "mongodb://localhost/VJ";
var app = express();
 // helpers
var db = require('./modules/dbutil');
// init HTTPs server
var options = {
    key: fs.readFileSync('server/cert/private.pem'),
    cert: fs.readFileSync('server/cert/public.pem')
};
var http = require('https').Server(options,app);
var io = require('socket.io')(http);
app.use(express.static('./application/public'));
app.get('/', function(req, res){
  res.sendfile('./application/index.html');
});

io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
  socket.on('chat message', function(msg){
    io.emit('chat message', msg);
  });
});

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