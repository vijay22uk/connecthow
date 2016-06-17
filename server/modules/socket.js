var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var mongoDb = require('../modules/dbutil');
var users = {};
module.exports = function (io) {
    //heartbeat timeout and interval defaults (60 and 25 seconds)
    io.sockets.on('connection', function (socket, data) {
        var classroom, emailId ;
        socket.on('message', function (msg) {
            msg.timeStamp = new Date().getTime();
            console.log(msg.room);
            socket.in(msg.room).emit("message",msg);
        });
        socket.on('join', function (data) {
            socket.emailId = emailId = data.emailId;
            socket.classroom = classroom = data.room;
            var userClassRoom = getClassRoom(classroom);
            userClassRoom[emailId] = true;
            socket.join(classroom);
            console.log("Joining "+ emailId);
            socket.emit("pendingData",users[classroom]);
            socket.to(classroom).emit("message",{ room:classroom,target:"join",emailId:emailId  });
        });
        socket.on('disconnect', function (socket) {
           var userClassRoom = getClassRoom(classroom);
           console.log("disconnect"+ emailId);
           //userClassRoom[emailId] = false;
           delete userClassRoom[emailId];
           //delete object if zero
           io.in(classroom).emit("message",{ room:classroom,target:"leave",emailId:emailId  });
        });
    });

}

function getClassRoom(_room){
    users[_room] = users[_room] || {  }
    return users[_room];
}

