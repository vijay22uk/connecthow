var redis = require('redis');
var fs = require('fs');
var colorHelper = require('../lib/color.js');
var request = require('request');// 1 hour
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var mongoDb = require('../lib/mongoutil');
var config = require('../config/config.js');
var moment = require('moment');
var ewsUrl = config.ewsUrl;
var timeoutVar = config.apiTimeoutValue;
var maxIdleTime = config.maxIdleTime;
var mongoDBConnectionString = config.mongoConnection;
//config.redisOptions = {host: "127.16.20.98",port:6379};
var pub = redis.createClient(config.redisOptions);
var redisDataClient = redis.createClient(config.redisOptions);
module.exports = function (io) {
    //heartbeat timeout and interval defaults (60 and 25 seconds)
    io.set('heartbeat timeout', 10000);
    io.set('heartbeat interval', 20000);
    var room = "", io = io;
    io.room = "";
    io.sockets.on('connection', function (socket, data) {
        var userData;
        var socketid;
        var subToRoom = redis.createClient(config.redisOptions);
        var subToSelf = redis.createClient(config.redisOptions);
        socket.on('message', function (msg) {
            msg.timeStamp = new Date().getTime();
            msg.when = moment.utc().format();
            redisDataClient.set('timer_' + room, -1);
            if (msg.event == "reconnect") {
                var sendData;
                var room = msg.target;
                setUserOnline(room, msg.sender,msg.payload.sessionType);
                subToRoom.unsubscribe();
                subToSelf.unsubscribe();
                subToSelf.subscribe('room_' + msg.sender);
                subToRoom.subscribe('room_' + room);
                var data = msg;
                data.event = "join";
                userData = data;
                data.reconnectJoin = true;
                pub.publish('room_' + data.target, JSON.stringify(data));
                data.event = "reconnect";
                sendData = {
                    target: room,
                    sender: msg.sender,
                    messageId: null,
                    event: 'reconnectData',
                    subEvent: 'reconnectStart'
                }

                //TODO 


                socket.emit('message', sendData);

                if (!mongoDb.get()) {
                    socket.emit("sessionerr", { msg: "Unable to connect to Db" });
                    return;
                }
                var db = mongoDb.get();
                //var deleteIds = db.collection('chat' + room).find({ subEvent: "deleteObject" }).map(function (obj) {
                //    return obj.payload.options.id;
                //});
                mongoDb.get().collection('chat' + room).find({ $or: [{ 'subEvent': { $nin: ["pointer", "marker"] }, 'event': { $nin: ["join", "disconnect", "audioFile"] } }] }).sort({ timeStamp: 1 }).toArray(function (err, doc) {
                    var _doc = doc || [];
                    redisDataClient.get(msg.target, function (err, isStarted) {
                        var chatMessages = [];
                        _doc.splice(0, 0, { "isStarted": isStarted });
                        //chatMessages.push({ "isStarted": isStarted });
                        //for (var i = 1; i < doc.length; i++) {
                        //    if (doc[i].subEvent !== "pointer" || doc[i].subEvent !== "marker") {
                        //        chatMessages.push(doc[i]);
                        //    }
                        //}
                        sendData = {
                            target: room,
                            sender: msg.sender,
                            messageId: null,
                            event: 'reconnectData',
                            subEvent: 'chatData',
                            payload: {
                                chatData: _doc
                            }
                        }
                        socket.emit('message', sendData);
                        getUserInfo(db, room, socket, msg.sender);
                    });

                    redisDataClient.get("starttimer_" + msg.target, function (err, hasTimer) {

                        if (hasTimer) {
                            sendData = {
                                target: room,
                                sender: msg.sender,
                                messageId: null,
                                event: 'reconnectData',
                                subEvent: 'timerData',
                                payload: {
                                    timerStart: hasTimer,
                                    serverTime: new Date().getTime()
                                }
                            }

                            socket.emit('message', sendData);
                        }
                    });

                });

                //timer data instant
                mongoDb.get().collection("SessionInfo").findOne({ sessionId: msg.target }, function (err, sessionInfo) {
                    if (err || sessionInfo == null) return;
                    sessionInfo.timerSetting = sessionInfo.timerSetting || {};
                    sessionInfo.timerSetting.serverTime = new Date().getTime();
                    var sendData = {
                        target: room,
                        sender: msg.sender,
                        messageId: null,
                        event: 'reconnectData',
                        subEvent: 'timerSetting',
                        payload: {
                            timerSetting: sessionInfo.timerSetting
                        }
                    }
                    socket.emit('message', sendData);
                });

                //MongoClient.connect(mongoDBConnectionString, function (err, db) {
                //    db.collection('chat' + room).find({ $query: {}, $orderby: { timestamp : 1 } } ).toArray(function (err, doc) {

                //    });
                //});

                //TODO updateSocketId(room, msg.sender, msg.socketId);
            }
            //if (msg.event == "mousedownEvent") {
            //    debugger;
            //    redisDataClient.set('isMouseDown_' + msg.target, true);
            //}

            if (msg.event == "mousedownEvent") {
                redisDataClient.get("isMouseDown_" + msg.target, function (err, isMouseDown) {
                    var data;
                    var index = -1;
                    if (isMouseDown) {
                        data = JSON.parse(isMouseDown);
                        for (var i = 0; data.userId.length > i; i++) {
                            if (data.userId[i].uId == msg.sender) {
                                index = i;
                                break;
                            }
                        }
                        if (index != -1) {
                            data.userId[index].timeStamp = new Date().getTime();
                        }
                    }
                    else {
                        data = { userId: [], sessionId: msg.target }
                    }
                    //to check is user already exist
                    if (index == -1)
                        data.userId.push({ uId: msg.sender, timeStamp: new Date().getTime() });
                    redisDataClient.set('isMouseDown_' + msg.target, JSON.stringify(data));
                })
            }

            if (msg.event == "mouseupEvent") {

                //redisDataClient.set('isMouseDown_' + msg.target, false);
                redisDataClient.get("isMouseDown_" + msg.target, function (err, isMouseDown) {
                    var data;
                    if (isMouseDown) {
                        data = JSON.parse(isMouseDown);

                    } else {
                        data = { userId: [], sessionId: msg.target }
                    }
                    var index = -1;
                    for (var i = 0; data.userId.length > i; i++) {
                        if (data.userId[i].uId == msg.sender) {
                            index = i;
                            break;
                        }
                    }
                    if (index != -1) {
                        data.userId.splice(index, 1);
                    }
                    redisDataClient.set('isMouseDown_' + msg.target, JSON.stringify(data));
                });
            }

            if (msg.event == "addingNewWhiteBoardPermission") {

                redisDataClient.get("isMouseDown_" + msg.target, function (err, isMouseDown) {
                    //emitting to self as socket here points to same client as sender
                    var _isMouseDown = false;
                    var data;
                    if (isMouseDown) {
                        data = JSON.parse(isMouseDown);
                        var currentTime = new Date().getTime();
                        for (var i = 0; data.userId.length > i; i++) {
                            if (currentTime - data.userId[i].timeStamp > 10000) {
                                data.userId.splice(i, 1);
                            }
                        }

                        _isMouseDown = data.userId.length > 0 ? true : false;
                    }
                    socket.emit("canAddNew", { canAdd: data, eventType: msg.payload.currentEvent, wbId: msg.payload.wbId });
                });
            }
            if (msg.event !== "timer") {
                if (msg.event == "stop") {
                }
                pub.publish('room_' + msg.target, JSON.stringify(msg));
            } else {
                setTimerSettings(msg);
            }


            if (msg.event == "start") {
                redisDataClient.set(msg.target, 1);
                redisDataClient.get("starttimer_" + msg.target, function (err, hasTimer) {
                    //console.log("Update");

                    if (!hasTimer) {
                        debugger
                        var startTime = new Date().getTime();
                        redisDataClient.set("starttimer_" + msg.target, JSON.stringify(startTime));
                        setTotalTimeforSession(msg.payload.sessionTimeLeft, msg.target, msg.payload.sessionType, startTime);
                        if (msg.payload.sessionType === "schedule") {
                            startTimer(msg.payload.sessionTimeLeft, msg.target);
                        }
                    }
                });
            }

            // timer intercept
            //if (msg.event == "timer") {

            //    setTimerSettings(msg);

            //}
            if (msg.event == "stop") {
                // console.log("stoping ");
                //stopSession(msg.target);
                endSession(msg.target, msg.sender);
            }

        });
        socket.on("leave", function (message) {
            pub.publish('room_' + message.target, JSON.stringify(message));
        });

        socket.on('reconnect', function (data) {

            //@ socket close count--
            //MongoClient.connect(mongoDBConnectionString, function (err, db) {

            //    if (err) {
            //        throw err;
            //    }
            //    else {

            //        db.collection("SessionInfo").findOne({ sessionId: userData.target }, function (err, sessionInfo) {
            //            if (sessionInfo == null)
            //                throw 'Session Not Started';

            //            if (userData.payload.userType !== "teacher") {
            //                sessionInfo.studentCount++;

            //            }
            //            else {
            //                sessionInfo.teacherCount++;
            //            }

            //            db.collection("SessionInfo").update({ "_id": sessionInfo._id }, sessionInfo);
            //        });
            //    }
            //});

        });
        /*************************disconnect handle *****************/
        socket.on('connect_failed', function (ss) {
            console.log('connect_failed ' + ss);
        });
        socket.on('error', function (err) {
            console.log('error: ' + err);
        });
        socket.on('reconnect_failed', function () {
            console.log('reconnect_failed');
        });


        socket.on('join', function (data) {
            var studentExist = false;
            userData = data;
            room = data.target;
            io.room = room;
            socketid = socket.id;
            data.timeStamp = new Date().getTime();
            data.when = moment.utc().format();

            // redisDataClient.set('timer_' + room, -1);
            var colrs = null;
            var totaluser = 0;
            updateUserName(userData.payload.userName, userData.userBindingId);
            //Mongo Db get session data 
            if (data.payload.userType !== "teacher") {
                if (!mongoDb.get()) {
                    return;
                }
                else {
                    var db = mongoDb.get();
                    db.collection("SessionInfo").findOne({ sessionId: data.target }, function (err, sessionInfo) {
                        console.log(  err  );
                        if (sessionInfo == null) {
                            socket.emit("sessionerr", 'Session Not Started');
                            return;
                        }
                        sessionInfo.studentCount++;
                        var currentuser = null;
                       // sessionInfo.liveUsers++;
                        //console.log(sessionInfo.users);
                        sessionInfo.users = sessionInfo.users || [];
                        totaluser = sessionInfo.users.length;
                        for (var i = 0; i < sessionInfo.users.length; i++) {
                            if (sessionInfo.users[i].userId !== data.sender && sessionInfo.users[i].userType === "student" && data.payload.sessionType === "instant") studentExist = true;

                            if (sessionInfo.users[i].userId == data.sender) {
                                currentuser = sessionInfo.users[i];
                                currentuser.i = i;
                                colrs = sessionInfo.users[i].color;
                                //break;
                            }
                        }
                        if (studentExist) {
                            // socket.emit('error_teacher', "Only One Student can join this session");
                            // return;
                        }
                        var timeoutDelay = 10;
                        if (currentuser != null) {
                            sessionInfo.users.splice(currentuser.i, 1);
                            currentuser.room = currentuser.userId;

                            disConnectSocket(currentuser.socketId, currentuser);
                            timeoutDelay = 2000;
                        } else {
                            colrs = colorHelper.getColor(totaluser);
                            //sessionInfo.studentCount++;
                        }
                        /* TODO 1 */
                        setTimeout(function () {
                            subToSelf.subscribe('room_' + data.sender);
                            subToRoom.subscribe('room_' + room);
                            //socket.join(room);
                            pub.publish('room_' + data.target, JSON.stringify(data));
                            socket.emit("color", colrs);
                            socket.emit("done");
                            //sessionInfo.users.push({ uType: data.uType, userId: data.sender, room: room, socketId: socket.id, userType: data.payload.userType, userName: data.payload.userName, userBindingId: data.payload.userBindingId, disconnected: false, color: colrs, userMetadata: [{ agent: data.payload.agent, other: data.payload.other }] });
                            sessionInfo.users.push({ uType: data.uType, userId: data.sender, room: room, socketId: socket.id, userType: data.payload.userType, userName: data.payload.userName, userBindingId: data.payload.userBindingId, disconnected: false, color: colrs });
                            db.collection("SessionInfo").update({ "_id": sessionInfo._id }, sessionInfo, function (err, data) {
                                //console.log(err);
                            });
                        }, timeoutDelay);
                    });
                    //if count zero return {} else loop
                }

                /* TODO 1    subToSelf.subscribe('room_' + data.sender);
                     subToRoom.subscribe('room_' + room);
                     socket.join(room);
                     
                     pub.publish('room_' + data.target, JSON.stringify(data));
                    */
            }
            else {

                if (!mongoDb.get()) {
                    return;
                }
                else {
                    var db = mongoDb.get();
                    db.collection("SessionInfo").findOne({ sessionId: data.target }, function (err, sessionInfo) {
                        if (sessionInfo == null) {
                            socket.emit("sessionerr", 'Session Not Started');
                            return;
                        }

                        var currentuser = null;
                       // sessionInfo.liveUsers++;
                        sessionInfo.users = sessionInfo.users || [];
                        totaluser = sessionInfo.users.length;
                        for (var i = 0; i < sessionInfo.users.length; i++) {
                            if (sessionInfo.users[i].userId == data.sender) {
                                currentuser = sessionInfo.users[i];
                                currentuser.i = i;
                                break;
                            }

                        }
                        var timeoutDelay = 10;
                        if (currentuser != null) {
                            sessionInfo.users.splice(currentuser.i, 1);
                            currentuser.room = currentuser.userId;
                            colrs = currentuser.color;
                            disConnectSocket(currentuser.socketId, currentuser);
                            timeoutDelay = 2000;
                        }
                        else {
                            sessionInfo.teacherCount++;
                            if (sessionInfo.teacherCount > 1) {
                                socket.emit('error_teacher', "Only One tutor can join this session");
                            }
                            colrs = colorHelper.getColor(totaluser);
                        }

                        /* TODO 2 */
                        setTimeout(function () {
                            subToSelf.subscribe('room_' + data.sender);
                            subToRoom.subscribe('room_' + room);
                            pub.publish('room_' + data.target, JSON.stringify(data));
                            socket.emit("color", colrs);
                            socket.emit("done");
                            sessionInfo.users.push({ uType: data.uType, userId: data.sender, room: room, socketId: socket.id, userName: data.payload.userName, userType: data.payload.userType, userBindingId: data.payload.userBindingId, disconnected: false, color: colrs });
                            db.collection("SessionInfo").update({ "_id": sessionInfo._id }, sessionInfo, function (err) {

                            });
                        }, timeoutDelay);
                    });
                    //if count zero return {} else loop
                }

                /* TODO 2
                 subToSelf.subscribe('room_' + data.sender);
                 subToRoom.subscribe('room_' + room);
                 socket.join(room);
                 pub.publish('room_' + data.target, JSON.stringify(data));
               */
            }

        });
        socket.on('unsubscribe', function (room) {
            subToRoom.unsubscribe();
            subToSelf.unsubscribe();
            //subToRoom.end();
            // subToSelf.end();
        });
        socket.on('disconnect', function (socket) {

            subToRoom.unsubscribe();
            subToSelf.unsubscribe();
            //subToRoom.end();
            //subToSelf.end();
            if (userData) {
                // console.log("Disconneted -- Event userdata ", userData.sender);

                userData.payload = userData.payload || {};
                var sendData = {
                    target: userData.target || "",
                    sender: userData.sender || "",
                    messageId: null,
                    timeStamp: new Date().getTime() - 700,
                    when: moment.utc().format(),
                    event: 'disconnect',
                    subEvent: 'user',
                    payload: {
                        userId: userData.sender || "",
                        userType: userData.payload.userType || "",
                        userName: userData.payload.userName || " "
                    }
                }

                console.log('disconnected -- %s', userData.sender);
                pub.publish('room_' + userData.target, JSON.stringify(sendData));
                
                //updatesessionapi
                var _sendData = {
                    target: userData.target || "",
                    sender: userData.sender || "",
                    messageId: null,
                    event: 'timer',
                    subEvent: 'stop',
                    payload: {
                        userId: userData.sender || "",
                        userType: userData.payload.userType || "",
                        userName: userData.payload.userName || " "
                    }
                }
                // pub.publish('room_' + userData.target, JSON.stringify(_sendData));
                //setTimerSettings(_sendData);
                userCount(userData.target, function () {
                  

                    if (!mongoDb.get()) {
                        return;
                    }
                    else {
                        var db = mongoDb.get();
                        db.collection("SessionInfo").findOne({ sessionId: userData.target }, function (err, sessionInfo) {
                            if (err || sessionInfo == null) {
                                return;
                            }

                            if (userData.payload.userType !== "teacher") {
                                sessionInfo.studentCount--;

                            }
                            else {
                                sessionInfo.teacherCount--;
                            }
                            if (sessionInfo.studentCount < 0) {
                                sessionInfo.studentCount = 0;
                            }

                            if (sessionInfo.teacherCount < 0) {
                                sessionInfo.teacherCount = 0;
                            }
                            if (sessionInfo.studentCount <= 0 && sessionInfo.teacherCount <= 0) {
                                // startsessionEndTimer(sessionInfo.sessionId);
                            }
                            for (var i = 0; i < sessionInfo.users.length; i++) {
                                if (sessionInfo.users[i].userId == userData.sender) {
                                    sessionInfo.users[i].disconnected = true;
                                    break;
                                }
                            }


                            //sessionInfo.liveUsers = sessionInfo.liveUsers - 1;
                            var _sendData = {
                                target: userData.target || "",
                                sender: userData.sender || "",
                                messageId: null,
                                event: 'timer',
                                subEvent: 'stop',
                                payload: {
                                    userId: userData.sender || "",
                                    userType: userData.payload.userType || "",
                                    userName: userData.payload.userName || " "
                                }
                            }

                            if (sessionInfo.timerSetting.iSstart && !sessionInfo.timerSetting.isPaused) {
                                //    pub.publish('room_' + userData.target, JSON.stringify(_sendData));
                                if (sessionInfo.sessionType == "schedule") {
                                    checkScheduleTimer(_sendData,userData.target);
                                    //scheduled
                                } else {
                                    setTimerSettings(_sendData);
                                }
                            }

                            //       setTimerSettings(_sendData);

                            db.collection("SessionInfo").update({ "_id": sessionInfo._id }, sessionInfo, function (err) {
                                console.log(err);
                            });
                        });
                    }
                },userData.sender);

            } else {
                console.log("No user data found");
            }
            //subToRoom.unsubscribe();
            //subToSelf.unsubscribe();
        });

        subToRoom.on('message', function (channel, message) {
            var messageData = JSON.parse(message);

            if (messageData.event !== "audioFile") {

                if (messageData.event == "forceClose" && socket.id == message.socketId) {
                    socket.emit('message', messageData);
                    socket.close();
                    subToRoom.unsubscribe();
                    subToSelf.unsubscribe();
                } else {
                    if (messageData.event == "stop") {

                        debugger
                    }
                    socket.emit('message', messageData);
                }
            }
        });
        subToSelf.on('message', function (channel, message) {
            var messageData = JSON.parse(message);
            if (message.event !== "audioFile") {
                if (message.event == "forceClose") {
                    // subToRoom.unsubscribe();
                    // subToSelf.unsubscribe();
                    socket.emit('message', messageData);
                } else {
                    socket.emit('message', messageData);
                }
            }
        });
    });

}

function disConnectSocket(socketId, userData) {
    decrementUserCount(userData.room);
    userData.event = "forceClose";
    pub.publish('room_' + userData.room, JSON.stringify(userData));
}

function getTotalConnection(io, room) {
    try {
        var namespace = '/';
        var room = io.nsps[namespace].adapter.rooms[room];
        if (!room) return null;
        var num = 0;
        for (var i in room) num++;
        return num;
    }
    catch (err) {
        return null;
    }
}
function log(msg) {
    for (var i = 0; i < msg.length; i++) {
        console.log(msg[i]);
    }

}
function stopSession(target, userId, callback) {
    if (mongoDb.get()) {
        var db = mongoDb.get();
        db.collection("SessionInfo").findOne({ sessionId: target }, function (err, sessionInfo) {
            if (sessionInfo == null) {

            } else {

                sessionInfo.completed = true;
                sessionInfo.isSaved = false;
                sessionInfo.end_actor = userId;
                sessionInfo.endTime = new Date().getTime();//moment(new Date()).format('DD-MM-YYYY hh:mm:ss')
                db.collection("SessionInfo").update({ "_id": sessionInfo._id }, sessionInfo, function () {
                    createTextChatFile(sessionInfo.sessionId);
                    db.collection("EssUserBindings").remove({ "sessionId": target });
                    if (callback) {
                        callback(target);
                    }

                });
            }
        });
    }

}

function startsessionEndTimer(sessionId) {

    //var timerId = setTimeout(function () { endSession(sessionId); }, maxIdleTime);
    //redisDataClient.set('timer_' + sessionId, 1);

}
function clearsessionEndTimer(sessionId) {
    redisDataClient.get('timer_' + sessionId, function (err, timerId) {
        if (timerId != null) {
            //clearTimeout(timerId);
        }

        redisDataClient.set('timer_' + sessionId, null);

    });

}

function endSession(sessionId, userId) {
    // EndSession/sessionId
    //redisDataClient.get('timer_' + sessionId, function (err, timerId) {
    //   if (timerId != null && timerId != -1) {
    stopSession(sessionId, userId, function () {
        // pub.publish('room_' + sessionId, JSON.stringify({ event: "markedClose" }));
    });
    //var sessionData = {};
    //sessionData.duration = timerId - (new Date().getTime());
    //sessionData.start_time = 0;
    //sessionData.end_time = new Date().getTime();
    //sessionData.pause_time = new Date().getTime();
    //sessionData.end_actor = "system";
    //sessionData.audio_url = "";
    //sessionData.wh_url = "";
    //sessionData.participants = null;
    //sessionData.quality = .8;
    //sessionData.endSessionData = sessionData;
    //request({
    //    rejectUnauthorized: false, timeout: timeoutVar,
    //    url: ewsUrl + 'EndSession/' + sessionId,
    //    body: sessionData,
    //    json: true,
    //    method: 'post'
    //}, function (error, response, body) {
    //    //TODO in case of error
    //    stopSession(sessionId);
    //});


    redisDataClient.set('timer_' + sessionId, -1);
    //});



}

function createTextChatFile(sessionId) {
    //if (mongoDb.get()) {

    //    var db = mongoDb.get();
    //        db.collection('chat' + sessionId).find({}).toArray(function (err, doc) {
    //            var outputFilename ="./public/data/" + sessionId + '.json';
    //            fs.writeFile(outputFilename, JSON.stringify(doc), function (err) {
    //                if (err) {
    //                    //console.log(err);
    //                } else {
    //                    console.log("JSON saved to " + outputFilename);

    //                }
    //            });

    //        });

    //    }


}


function getUserInfo(db, sessionId, socket, userId) {
    var sendData = {};
    db.collection("SessionInfo").findOne({ sessionId: sessionId }, function (err, sessionInfo) {
        if (sessionInfo == null) {
            socket.emit("sessionerr", 'Session Not Started');
            return;
        }
        if (sessionInfo.completed) {
            socket.emit("message", { event: "sessionClose" });
            return;

        }

        sessionInfo.users = sessionInfo.users || [];
        sendData = {
            target: sessionId,
            sender: userId,
            messageId: null,
            event: 'reconnectData',
            subEvent: 'participantList',
            payload: {
                participantList: sessionInfo.users
            }
        }
        socket.emit('message', sendData);

        sendData = {
            target: sessionId,
            sender: userId,
            messageId: null,
            event: 'reconnectData',
            subEvent: 'reconnectEnd',
            payload: {
                participantList: sessionInfo.users
            }
        }
        socket.emit('message', sendData);
    });


}


function setTotalTimeforSession(sessionTimeLeft, sessionName, sessionType, startTime) {

    if (!mongoDb.get()) {
        return;
    }
    else {
        var db = mongoDb.get();
        db.collection("SessionInfo").update({ sessionId: sessionName }, {
            $set:
      {
          "sessionTimeLeft": sessionTimeLeft,
          "startTime": startTime,
          "sessionType": sessionType
      }
        }, function (err) {

            console.log(err);
        });
    }

}

function setTimerSettings(msg,no) {
    /*
        this.iSstart  = false;
        this.startTime = null;
        this.pause  = [];
        this.resume = [];
        this.isPaused = false;
        this.totalElapsedTime = 0;
        this.stopTime = null;
    */
    if (!mongoDb.get()) {
        //socket.emit("error", { msg: "Unable to connect to Db" });
        return;
    }
    var db = mongoDb.get();
    msg.timeStamp =  msg.timeStamp || new Date().getTime();
    db.collection("SessionInfo").findOne({ sessionId: msg.target }, function (err, sessionInfo) {
        if (err || sessionInfo == null) return;
        debugger
        sessionInfo.timerSetting = sessionInfo.timerSetting || new InstantTimer();
        var isDirty = false; 
        if (msg.subEvent === "start") {
            sessionInfo.timerSetting.iSstart = true;
            sessionInfo.timerSetting.startTime = new Date().getTime();
            sessionInfo.timerSetting.lastStart = new Date().getTime();
            sessionInfo.timerSetting.totalElapsedTime = 0;

        }
        else if (msg.subEvent === "stop") {
            if (sessionInfo.timerSetting.iSstart && !sessionInfo.timerSetting.isPaused) {
                sessionInfo.timerSetting.isPaused = true;
                sessionInfo.timerSetting.totalElapsedTime += new Date().getTime() - sessionInfo.timerSetting.lastStart;
            }
        }
        else {
            // resume
            if(!sessionInfo.timerSetting.isPaused){
                sessionInfo.timerSetting.totalElapsedTime += (new Date().getTime() - sessionInfo.timerSetting.lastStart); 
                
            }
            sessionInfo.timerSetting.isPaused = false;
           /* 
            if(!sessionInfo.timerSetting.totalElapsedTime){
                isDirty = true;
                sessionInfo.timerSetting.totalElapsedTime += (new Date().getTime() - sessionInfo.timerSetting.lastStart);
            }else{
                sessionInfo.timerSetting.lastStart = new Date().getTime();
            }
            */
             sessionInfo.timerSetting.lastStart = new Date().getTime();
        }
        //msg.totalElapsedTime = 1000;
        msg.totalElapsedTime = sessionInfo.timerSetting.totalElapsedTime;
        pub.publish('room_' + msg.target, JSON.stringify(msg));
        db.collection("SessionInfo").update({ "_id": sessionInfo._id }, sessionInfo);
    });

}

var InstantTimer = function () {
    this.iSstart = false;
    this.startTime = null;
    this.pause = [];
    this.resume = [];
    this.isPaused = false;
    this.totalElapsedTime = 0;
    this.stopTime = null;
}

function updateUserName(userName, userId) {

    if (!mongoDb.get()) {
        return;
    }
    var db = mongoDb.get();
    db.collection('EssUserBindings').findOne({ "_id": new ObjectId(userId) }, function (err, doc) {

        if (err) {

            return;
        }
        if (doc) {
            doc.userName = userName;
            db.collection("EssUserBindings").update({ "_id": doc._id }, doc, function (err, data) {
                //console.log(err);
            });
        }
    });


}

function updateSocketId(room, sender, socketId) {

    if (!mongoDb.get()) {
        return;
    }
    else {
        var db = mongoDb.get();
        db.collection("SessionInfo").findOne({ sessionId: room }, function (err, sessionInfo) {
            if (sessionInfo == null) {
                return;
            }
            sessionInfo.studentCount++;
            var currentuser = null;
            //console.log(sessionInfo.users);
            sessionInfo.users = sessionInfo.users || [];
            for (var i = 0; i < sessionInfo.users.length; i++) {
                if (sessionInfo.users[i].userId === sender) {
                    sessionInfo.users[i].socketId = socketId;
                    break;
                    //break;
                }
            }

            db.collection("SessionInfo").update({ "_id": sessionInfo._id }, sessionInfo, function (err) {
               // console.log("socekt id updated to" + socketId);

            });
        });
    }


}


  function startTimer(_totalPlayTime,room) {
    var sendData = {
        target: room,
        sender: "sys",
        messageId: null,
        event: 'timer',
        timeStamp : new Date().getTime(),
        totalPlayTime : _totalPlayTime|| 9999999,
        subEvent: 'start',
        payload: {
            userName: "sys",
            userId: 'sys',
            userType: "student"
        }
    }
      // socket.emit('message', sendData);
      //pub.publish('room_' + room, JSON.stringify(sendData));
    // console.log("Timer start :::::");
    setTimerSettings(sendData);
  }

  function resumeTimer(room) {
      var sendData = {
          target: room,
          sender: "sys",
          messageId: null,
          timeStamp : new Date().getTime(),
          event: 'timer',
          subEvent: 'resume',
          payload: {
              userName: "sys",
              userId: "sys",
              userType: "student"
          }
      }
      // console.log("Timer resume :::::");
      setTimerSettings(sendData);
  }

function setUserOnline(room, userId,sessionType) {
    
    var db = mongoDb.get();
//    db.collection("SessionInfo").update({ sessionId: room, "users.userId": userId },
//    { $set: { "users.$.disconnected": false, "users.$.userName": username } }
    //);

    //db.collection("SessionInfo").update({ sessionId: room, "users.userId": userId },
    //{ $set: { "users.$.disconnected": false } });
    
      db.collection("SessionInfo").update({ sessionId: room },
     { $inc: { "liveUsers": 1 } }, function (err, doc) {
         if(sessionType == "schedule"){
             resumeTimerIfLive(room);
         }
        // console.log(err);
        // console.log(doc);

     }
    );

      var prop = "liveUsersList." + userId;
      db.collection("SessionInfo").update({ sessionId: room }, {
          $set: {
              ['liveUsersList.' + userId]: true
          }
      });

}

function userCount(room,callback,userId) {
    var db = mongoDb.get();
    db.collection("SessionInfo").update({ sessionId: room },
    { $inc: { "liveUsers": -1 } }, function (err, doc) {
        callback();
    }
   );
    var prop = "liveUsersList." + userId;
    db.collection("SessionInfo").update({ sessionId: room }, {
        $set: {
            ['liveUsersList.' + userId]: false
        }
    });
}

function decrementUserCount(room){
    var db = mongoDb.get();
    db.collection("SessionInfo").update({ sessionId: room },
    { $inc: { "liveUsers": -1 } }
   );

}

function resumeTimerIfLive(room) {
  //  console.log(  "resume check"  );
    setTimeout(function(){   
        var db = mongoDb.get();
        db.collection("SessionInfo").findOne({ sessionId: room }, { "timerSetting": 1, liveUsers: 1,"liveUsersList":1 }, function (err, doc) {
            console.log(err);
            if (!err) {
                var live = 0;
                for (var k in doc.liveUsersList){
                    if (doc.liveUsersList.hasOwnProperty(k) && doc.liveUsersList[k]) {
                        live++; 
                    }
                }
                // console.log(  "resume"  +live );
                if(live >= 2){
                    //doc.timerSetting.isPaused
                    if (doc.timerSetting.iSstart) {
                        resumeTimer(room);
                    }
            
                }
            
            }
        });

    },3000);
}

function checkScheduleTimer(senddata,room){
    // console.log(  "disconnect check"  );

    setTimeout(function(){   
        var db = mongoDb.get();
        db.collection("SessionInfo").findOne({ sessionId: room }, { "timerSetting": 1, liveUsers: 1,"liveUsersList":1 }, function (err, doc) {
            console.log(err);
            if (!err) {
                var live = 0;

                for (var k in doc.liveUsersList){
                    if (doc.liveUsersList.hasOwnProperty(k) && doc.liveUsersList[k]) {
                        live++; 
                    }
                }

              
                //console.log(  "disconnect"  +live );
                if (live < 2) {
                    setTimerSettings(senddata);
                }

            }});

    },100);


}