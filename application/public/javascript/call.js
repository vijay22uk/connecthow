(function (window) {
  'use strict';
  var _callbacks = {
    onReadyForStream: function (connection) {
        // The connection manager needs our stream
        // todo: not sure I like this
        //alert('Adding my stream to remote');
        if (myStream) connection.addStream(myStream);
    },
    onStreamAdded: function (connection, event) {
        $('#audio_' + connection.parterId).closest('li').css({ background: 'rgb(144, 186, 253)' });
        console.log("stream from " + connection.parterId);
        attachMediaStream(document.getElementById('audio_' + connection.parterId), event.stream); // from adapter.js
        ko.utils.arrayForEach(window.app.participants(), function (participant) {
            if (participant.emailId == connection.parterId) {
                isUserInList = participant;
            }
        });
        if (isUserInList) {
            isUserInList.hasStream = true;
        }
        window.inCall = true;
        $("#endCall").show();

        return false;
    },
    onStreamRemoved: function (connection, streamId) {
        $('#audio_' + connection.parterId).closest('li').css({ background: '#fff' });
        try{
            $('#audio_' + connection.parterId).removeAttr('src', '');
            var moz = !!navigator.mozGetUserMedia;
            if (moz) {
                $('#audio_' + connection.parterId).attr("mozSrcObject", null);
            }
        } catch (ee) {
            console.log(ee);
        }
    },

}
  $(document).ready(readycallback);
  var connectionManager = WebRtcDemo.ConnectionManager;
  function readycallback(){
	   $(document).on("click","#callAll",function(){
		   checkmediaStream();
	   });
	  
  }
  
  function checkmediaStream(){
      if(window.myStream){
          makeCall();
      }else{
        //  myStream
   getUserMedia(
               {
            audio: true
          },
              function (stream) { 
    window.myStream = stream;
    connectionManager.initialize(window.socket, _callbacks.onReadyForStream, _callbacks.onStreamAdded, _callbacks.onStreamRemoved, _callbacks.onStreamAddedConference, _callbacks.onStreamRemovedConference);
    makeCall();
         }, function (err) { toastr.error("Please attach your microphone and allow","Unable to get audio.") });
      }
  }
  
  function makeCall(){
      callAllParticipants();
  }
  
  function callParticipant(id,force) {
    setTimeout(function () {
        connectionManager.initiateOffer(id, window.myStream, false, force);
    }, 1000);


}

function callAllParticipants() {
    callAll();
}

function callAll() {
    ko.utils.arrayForEach(app.participants(), function (participant, index) {
        if (participant.userId !== user.emailid && !participant.hasStream) {
            connectionManager.initiateOffer(participant.userId, window.myStream, false);
            //@connectionManager.initiateConferenceOffer(participant.userId, window.myStream, room);
            var otherIds = [];
            for (var i = index + 1; i < app.participants().length; i++) {
                otherIds.push(app.participants()[i].userId);
            }
            if (otherIds.length > 0 && !window.inCall) {
                sendCallOther(participant.userId, otherIds);
            }
        }
    });



}

function sendCallOther(userId, otherIds) {
    var sendData = {
        room: window.user.classroom,
        emailId: window.user.emailid,
        messageId: null,
        target: 'callOther',
        type: 'initiate',
        ids: otherIds
    };
    socket.emit("message", sendData);
}

function callAllById(ids) {
    for (var i = 0; i < ids.length; i++) {
        callParticipant(ids[i]);
    }
}

function newCandidate(payload) {
    connectionManager.newSignal(payload.sender, payload.payload.options, false, payload.force);
}
  
})(window);