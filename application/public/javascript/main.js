(function (window) {
  'use strict';
  var canvasId = "canvasuiele";
  var socket,canvas,isJoined,app ;
  var connectionManager = WebRtcDemo.ConnectionManager;
  $(document).ready(documentReadyCallback);
  function documentReadyCallback(){
    toastr.options.progressBar = true;
    var canvas = document.getElementById(canvasId);  
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    $('#yourname').text(user.emailid);
    connectSocket();
    initCanvas();
    checkmediaStream();
  }
  function connectSocket(){
   window.socket =  socket = io();
     registersocketCallBack(socket);
     
  }
  function registersocketCallBack(s){
     s.on('joined', function (userInfo, clientId) {
        loadData();
        isJoined = true;
    });
    s.on('connect',function(){
         if (isJoined) {
            loadData();

        } else {
            joinRoom(user.classroom);
        }
        
    })
    s.on('pendingData',function(user){
        var _allUsers = [];
        for(var e in user){ 
            if(user[e]) _allUsers.push({emailId:e });
          }
         setParticipantList(_allUsers);
    });
    s.on('message', function (message) {
        onSocketMessage(message);
    });
  }
  function onSocketMessage(message){
      if(message.emailId !==user.emailid){
     switch (message.target) {
        case "canvas":
        onSocketMessage_canvas(message);
        break;
        case "audio":
        if(message.webRtcTarget === user.emailid){
        onSocketMessage_audio(message);
        }
        break;
        case "join":
          toastr.success(message.emailId +" has entered the classroom");
          setParticipantList([{emailId:message.emailId}])
        break;
         case "leave":
          toastr.success(message.emailId +" has left the classroom");
          removeUser(message.emailId);
        break;
        default:
        break;
      
         }
      }
  }
  function removeUser(userId) {
    
        var index = -1;
        var participant;
        ko.utils.arrayForEach(app.participants(), function (_participant, _index) {
            if (_participant.emailId == userId) {
                index = _index;
                participant = _participant;
            }
        });

        if (index !== -1) {
            app.participants.remove(participant);

        }
  }
  function onSocketMessage_canvas(message){
      switch (message.type) {
        case "path":
        addpathCanvas(message);
        break;
        default:
        break;
            }
  }
  
  function onSocketMessage_audio(message){
        if (!window.myStream) {
            toastr.error(message.emailId +' is trying to call you');

        } else {
            
            console.info(message);
            newWebRtcmsg(message);
        }

  }
  function newWebRtcmsg(message){
      connectionManager.newSignal(message.emailId, message.payload.options, false, message.force);
  }
  function initCanvas(){
      window.app = app = new ViewModel();
       ko.applyBindings(app);
      canvas = new fabric.Canvas(canvasId, {
      perPixelTargetFind: true,
            targetFindTolerance: 5,
      });
      
      attachCanvasCallbacks(canvas)
      canvas.isDrawingMode = true;
      //canvas.freeDrawingBrush.width = 5;
      canvas.freeDrawingCursor = "url('/icons/pencil.png') 2 25,auto";
  }
  
  function attachCanvasCallbacks(canvas) {
        canvas.on('path:created', function (path) {
            var drawingData = {
                "path": path.path.path,
                opts: {
                    "stroke": path.path.stroke,
                    "top": path.path.top,
                    "width": path.path.width,
                    "height": path.path.height,
                    "left": path.path.left,
                    "strokeWidth": path.path.strokeWidth,
                    "fill": path.path.fill,
                    "strokeLineCap": path.path.strokeLineCap,
                    "strokeLineJoin": path.path.strokeLineCap,
                    "selectable": false
                }
            };
             var sendData = {
                room: user.classroom,
                emailId: user.emailid,
                target: 'canvas',
                type: 'path',
                drawingData: drawingData
             }
            socket.emit('message', sendData);

        });
        
  }
   
   function addpathCanvas(data) {
        var path = new fabric.Path(data.drawingData.path)
        path.set({
            stroke: data.drawingData.opts.stroke, width: data.drawingData.opts.width, strokeWidth: data.drawingData.opts.strokeWidth, fill: null, selectable: false, "strokeLineCap":data.drawingData.opts.strokeLineCap,
            "strokeLineJoin": data.drawingData.opts.strokeLineCap
        });
        canvas.add(path);
        
   }
// socket join 
   function joinRoom(room) {
       
            socket.emit('join', {
            room: room,
            emailId: user.emailid,
            event: 'join'
        });
        
    }
 // loading previous data 
 function loadData(){
    socket.emit('loadData', { emailId : user.emailid });
 }
function setParticipantList(userList) {
        for (var i = 0; i < userList.length; i++) {
            //console.log(userList[i].userType);
                var isUserInList = false;
                ko.utils.arrayForEach(app.participants(), function (participant) {
                    if (participant.emailId == userList[i].emailId) {
                        isUserInList = true;
                    }
                });
                if (!isUserInList) app.participants.push(new ParticipantViewModel(userList[i].emailId));
        }
   
    }
  // view models
  function ViewModel(){
      var self = this;
      self.classRoom = user.classroom;
      self.participants = ko.observableArray();
  }
  function ParticipantViewModel(userName) {
        var self = this;
        self.hasStream =ko.observable(false);
        self.userName = userName;
        self.emailId = userName;
        self.callThis = function(data,event){
           if(self.emailId == user.emailid){
               var clr = '#'+Math.floor(Math.random()*16777215).toString(16);
            event.target.style.backgroundColor =   clr
            canvas.freeDrawingBrush.width = Math.floor((Math.random()*10) + 2);
            canvas.freeDrawingBrush.color =  clr;
               toastr.warning("Your pencil color is changed");
           };
           
           makeCall(self.userName);
            
        },
        self.disconnectThat = function(){
        connectionManager.closeConnection(self.emailId);
        connectionManager.deleteMyConnections(self.emailId,false);
        }
  }
  
  // audio code 
    var _callbacks = {
    onReadyForStream: function (connection) {
        // The connection manager needs our stream
        // todo: not sure I like this
        //alert('Adding my stream to remote');
        if (myStream) connection.addStream(myStream);
    },
    onStreamAdded: function (connection, event) {
        toastr.success("Received audio call from " + connection.parterId);
        var isUserInList ;
        attachMediaStream(document.getElementById('audio_' + connection.parterId), event.stream); // from adapter.js
        ko.utils.arrayForEach(window.app.participants(), function (participant) {
            if (participant.emailId == connection.parterId) {
                isUserInList = participant;
            }
        });
        if (isUserInList) {
            isUserInList.hasStream(true);
        }
        window.inCall = true;
        //$("#endCall").show();

        return false;
    },
    onStreamRemoved: function (connection, streamId) {
        //$('#audio_' + connection.parterId).closest('li').css({ background: '#fff' });
        try{
            debugger
            var isUserInList ;
            toastr.info("Disconnected audio call with "+ connection.parterId);
            ko.utils.arrayForEach(window.app.participants(), function (participant) {
            if (participant.emailId == connection.parterId) {
                isUserInList = participant;
            }
        });
        if (isUserInList) {
            isUserInList.hasStream(false);
        }
            //$('#audio_' + connection.parterId).removeAttr('src', '');
            var moz = !!navigator.mozGetUserMedia;
            if (moz) {
             //   $('#audio_' + connection.parterId).attr("mozSrcObject", null);
            }
        } catch (ee) {
            console.log(ee);
        }
    },

}
  
  
    function checkmediaStream(){
        //  myStream
   getUserMedia(
               {
            audio: true
          },
              function (stream) { 
    window.myStream = stream;
    connectionManager.initialize(window.socket, _callbacks.onReadyForStream, _callbacks.onStreamAdded, _callbacks.onStreamRemoved, _callbacks.onStreamAddedConference, _callbacks.onStreamRemovedConference);
    
         }, function (err) { toastr.error("Please attach your microphone and allow","Unable to get audio.") });
  
      }
  function makeCall(id){
      if(window.myStream){
          makeCallbyId(id);
      }else{
        //  myStream
   getUserMedia(
               {
            audio: true
          },
              function (stream) { 
    window.myStream = stream;
    connectionManager.initialize(window.socket, _callbacks.onReadyForStream, _callbacks.onStreamAdded, _callbacks.onStreamRemoved, _callbacks.onStreamAddedConference, _callbacks.onStreamRemovedConference);
     makeCallbyId(id);
         }, function (err) { toastr.error("Please attach your microphone and allow","Unable to get audio.") });
      }
  }
  
  function makeCallbyId(id){
        connectionManager.initiateOffer(id, window.myStream, false, true);
        }
  
  
  
  
})(window);
