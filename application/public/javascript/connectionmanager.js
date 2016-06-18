/// <reference path="adapter.js" />
//deleting old bandwwidth line and settting new bandwidth
var BandwidthHandler = (function () {
    function setBAS(sdp, bandwidth, isScreen) {
        if (!!navigator.mozGetUserMedia || !bandwidth) {
            return sdp;
        }
        if (bandwidth.audio || bandwidth.video || bandwidth.data) {
            sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');
        }
        if (bandwidth.audio) {
            sdp = sdp.replace(/a=mid:audio\r\n/g, 'a=mid:audio\r\nb=AS:' + bandwidth.audio + '\r\n');
        }
        if (bandwidth.video) {
            sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + (isScreen ? bandwidth.screen : bandwidth.video) + '\r\n');
        }
        return sdp;
    }

    // Find the line in sdpLines that starts with |prefix|, and, if specified,
    // contains |substr| (case-insensitive search).
    function findLine(sdpLines, prefix, substr) {
        return findLineInRange(sdpLines, 0, -1, prefix, substr);
    }

    // Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
    // and, if specified, contains |substr| (case-insensitive search).
    function findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
        var realEndLine = endLine !== -1 ? endLine : sdpLines.length;
        for (var i = startLine; i < realEndLine; ++i) {
            if (sdpLines[i].indexOf(prefix) === 0) {
                if (!substr ||
                    sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
                    return i;
                }
            }
        }
        return null;
    }

    // Gets the codec payload type from an a=rtpmap:X line.
    function getCodecPayloadType(sdpLine) {
        var pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
        var result = sdpLine.match(pattern);
        return (result && result.length === 2) ? result[1] : null;
    }

    function setVideoBitrates(sdp, params) {
        params = params || {};
        var xgoogle_min_bitrate = params.min;
        var xgoogle_max_bitrate = params.max;

        var sdpLines = sdp.split('\r\n');

        // VP8
        var vp8Index = findLine(sdpLines, 'a=rtpmap', 'VP8/90000');
        var vp8Payload;
        if (vp8Index) {
            vp8Payload = getCodecPayloadType(sdpLines[vp8Index]);
        }

        if (!vp8Payload) {
            return sdp;
        }

        var rtxIndex = findLine(sdpLines, 'a=rtpmap', 'rtx/90000');
        var rtxPayload;
        if (rtxIndex) {
            rtxPayload = getCodecPayloadType(sdpLines[rtxIndex]);
        }

        if (!rtxIndex) {
            return sdp;
        }

        var rtxFmtpLineIndex = findLine(sdpLines, 'a=fmtp:' + rtxPayload.toString());
        if (rtxFmtpLineIndex !== null) {
            var appendrtxNext = '\r\n';
            appendrtxNext += 'a=fmtp:' + vp8Payload + ' x-google-min-bitrate=' + (xgoogle_min_bitrate || '228') + '; x-google-max-bitrate=' + (xgoogle_max_bitrate || '228');
            sdpLines[rtxFmtpLineIndex] = sdpLines[rtxFmtpLineIndex].concat(appendrtxNext);
            sdp = sdpLines.join('\r\n');
        }

        return sdp;
    }

    function setOpusAttributes(sdp, params) {
        params = params || {};
        var sdpLines = sdp.split('\r\n');
        // Opus
        var opusIndex = findLine(sdpLines, 'a=rtpmap', 'opus/48000');
        var opusPayload;
        if (opusIndex) {
            opusPayload = getCodecPayloadType(sdpLines[opusIndex]);
        }
        if (!opusPayload) {
            return sdp;
        }
        var opusFmtpLineIndex = findLine(sdpLines, 'a=fmtp:' + opusPayload.toString());
        if (opusFmtpLineIndex === null) {
            return sdp;
        }
        var appendOpusNext = '';
        appendOpusNext += '; stereo=' + (typeof params.stereo != 'undefined' ? params.stereo : '1');
        appendOpusNext += '; sprop-stereo=' + (typeof params['sprop-stereo'] != 'undefined' ? params['sprop-stereo'] : '1');

        if (typeof params.maxaveragebitrate != 'undefined') {
            appendOpusNext += '; maxaveragebitrate=' + (params.maxaveragebitrate || 128 * 1024 * 8);
        }

        if (typeof params.maxplaybackrate != 'undefined') {
            appendOpusNext += '; maxplaybackrate=' + (params.maxplaybackrate || 128 * 1024 * 8);
        }

        if (typeof params.cbr != 'undefined') {
            appendOpusNext += '; cbr=' + (typeof params.cbr != 'undefined' ? params.cbr : '1');
        }

        if (typeof params.useinbandfec != 'undefined') {
            appendOpusNext += '; useinbandfec=' + params.useinbandfec;
        }

        if (typeof params.usedtx != 'undefined') {
            appendOpusNext += '; usedtx=' + params.usedtx;
        }

        if (typeof params.maxptime != 'undefined') {
            appendOpusNext += '\r\na=maxptime:' + params.maxptime;
        }

        sdpLines[opusFmtpLineIndex] = sdpLines[opusFmtpLineIndex].concat(appendOpusNext);

        sdp = sdpLines.join('\r\n');
        return sdp;
    }

    return {
        setApplicationSpecificBandwidth: function (sdp, bandwidth, isScreen) {
            return setBAS(sdp, bandwidth, isScreen);
        },
        setVideoBitrates: function (sdp, params) {
            return setVideoBitrates(sdp, params);
        },
        setOpusAttributes: function (sdp, params) {
            return setOpusAttributes(sdp, params);
        }
    };
})();



var WebRtcDemo = WebRtcDemo || {};
var id = 0;
/************************************************
ConnectionManager.js

Implements WebRTC connectivity for sharing video
streams, and surfaces functionality to the rest
of the app.

WebRTC API has been normalized using 'adapter.js'

************************************************/
WebRtcDemo.ConnectionManager = (function () {
    var _signaler, myConnections = {}
    _connections = {},
    _iceServers = [
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
        }], // stun.l.google.com - Firefox does not support DNS names.
    /* Callbacks */
    _onReadyForStreamCallback = function () { console.log('UNIMPLEMENTED: _onReadyForStreamCallback'); },
    _onStreamAddedCallback = function () { console.log('UNIMPLEMENTED: _onStreamAddedCallback'); },
    _onStreamRemovedCallback = function () { console.log('UNIMPLEMENTED: _onStreamRemovedCallback'); },
    _onStreamAddedConferenceCallback = function () { console.log('UNIMPLEMENTED: _onStreamAddedConferenceCallback'); },
    _onStreamRemovedConferenceCallback = function () { console.log('UNIMPLEMENTED: _onStreamRemovedConferenceCallback'); },
    // Initialize the ConnectionManager with a signaler and callbacks to handle events
    _initialize = function (signaler, onReadyForStream, onStreamAdded, onStreamRemoved, onStreamAddedConference, onStreamRemovedConference) {
        _signaler = signaler;
        _onReadyForStreamCallback = onReadyForStream || _onReadyForStreamCallback;
        _onStreamAddedCallback = onStreamAdded || _onStreamAddedCallback;
        _onStreamRemovedCallback = onStreamRemoved || _onStreamRemovedCallback;
        _onStreamAddedConferenceCallback = onStreamAddedConference || _onStreamAddedConferenceCallback;
        _onStreamRemovedConferenceCallback = onStreamRemovedConference || _onStreamRemovedConferenceCallback;

    },
    // Create a new WebRTC Peer Connection with the given partner
    _createConnection = function (partnerClientId, isVideoCall) {
        var connection = new RTCPeerConnection({ iceServers: window.iceList || _iceServers }, {
            optional: [
                { DtlsSrtpKeyAgreement: true }
            ]
        });
        connection.parterId = partnerClientId;
        // ICE Candidate Callback
        connection.onicecandidate = function (event) {
            if (event.candidate) {
                var sendData = {
                    room: user.classroom,
                    emailId: user.emailid,
                    target: 'audio',
                    webRtcTarget: connection.parterId,
                    type: 'candidate',
                    payload: {
                        options: {
                            candidate: JSON.stringify(event.candidate)
                        }
                    }
                }
                socket.emit('message', sendData);
            } else {
                // Null candidate means we are done collecting candidates.
            }
        };

        // State changing
        connection.oniceconnectionstatechange = function () {
                
            // Not doing anything here, but interesting to see the state transitions
            var states = {
                'iceConnectionState': connection.iceConnectionState,
                'iceGatheringState': connection.iceGatheringState,
                'readyState': connection.readyState,
                'signalingState': connection.signalingState
            };

            if (states.iceGatheringState === "complete" && states.iceConnectionState === "failed") {
                _closeConnection(connection.parterId);
            }
        };

        // Stream handlers
        connection.onaddstream = function (event) {
            // A stream was added, so surface it up to our UI via callback
            _onStreamAddedCallback(connection, event);
        };
        connection.onremovestream = function (event) {
            // A stream was removed
            _onStreamRemovedCallback(connection, event.stream.id);
        };
        // Store away the connection
        _connections[partnerClientId] = connection;

        // And return it
        return connection;
    },

    _createConnectionConference = function (partnerClientId, conferenceId) {
        // Create a new PeerConnection
        var connection = new RTCPeerConnection({ iceServers: iceServerList });
        // ICE Candidate Callback
        connection.onicecandidate = function (event) {
            if (event.candidate) {
                // Found a new candidate
            } else {
                // Null candidate means we are done collecting candidates.
                //console.log('WebRTC: ICE candidate gathering complete');
            }
        };

        // State changing
        connection.onstatechange = function () {
            // Not doing anything here, but interesting to see the state transitions
            var states = {
                'iceConnectionState': connection.iceConnectionState,
                'iceGatheringState': connection.iceGatheringState,
                'readyState': connection.readyState,
                'signalingState': connection.signalingState
            };

        };

        // Stream handlers
        connection.onaddstream = function (event) {
            //console.log('WebRTC: adding stream');
            // A stream was added, so surface it up to our UI via callback
            _onStreamAddedConferenceCallback(connection, partnerClientId, event);
        };

        connection.onremovestream = function (event) {
            //console.log('WebRTC: removing stream');
            // A stream was removed
            _onStreamRemovedConferenceCallback(connection, partnerClientId, event.stream.id);
        };

        // Store away the connection
        _connections[conferenceId][partnerClientId] = connection;

        // And return it
        return connection;
    },

    // Process a newly received SDP signal
    _receivedSdpSignal = function (connection, partnerClientId, sdp, isVideoCall) {
        console.log('new signal *******************************');

        connection.setRemoteDescription(new RTCSessionDescription(sdp), function () {
            if (connection.remoteDescription.type == "offer") {
                console.log('WebRTC: received offer, sending response...');
                _onReadyForStreamCallback(connection);
                connection.createAnswer(function (desc) {
                    console.log('WebRTC: createAnswer');
                    //desc.sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');
                    // desc.sdp.replace(/a=mid:audio\r\n/g, 'a=mid:audio\r\n b=AS:40\r\n');
                    // desc.sdp.replace('/48000/', '/8000/');
                    desc.sdp = preferBitRate(desc.sdp, 20, "audio");
                    desc.sdp = BandwidthHandler.setOpusAttributes(desc.sdp, {
                        'stereo': 0, // to disable stereo (to force mono audio)
                        'sprop-stereo': 0,
                        'maxaveragebitrate': 12000,
                        'maxplaybackrate': 8000, 
                        'cbr': 0, // disable cbr
                        'useinbandfec': 1, // use inband fec
                        'usedtx': 0, // use dtx
                        'maxptime': 30,
                        'sprop-maxcapturerate': 8000
                    });
                    connection.setLocalDescription(desc, function () {

                        var sendData = {
                            room: user.classroom,
                            emailId: user.emailid,
                            target: 'audio',
                            type: 'answerSDP',
                            webRtcTarget: connection.parterId,
                            payload: {
                                options: {
                                    SDP: JSON.stringify(connection.localDescription)
                                }
                            }
                        }
                        socket.emit('message', sendData);
                    }, function (err) {
                        console.error(err);
                    });
                }, function (err) {
                    console.error(err);
                });
            } else if (connection.remoteDescription.type == "answer") {
            }
        }, function (err) {
            console.log(err);
        });
    },
    // Process a newly received SDP signal
    _receivedSdpSignalConference = function (connection, partnerClientId, sdp) {
        var room = partnerClientId;
        var remoteDesc = new RTCSessionDescription(sdp);
        connection.setRemoteDescription(remoteDesc, function () {
            if (connection.remoteDescription.type == "offer") {
                // _onReadyForStreamCallback(connection);
                connection.createAnswer(function (desc) {
                    connection.setLocalDescription(desc, function () {

                    });
                });
            } else if (connection.remoteDescription.type == "answer") {
            }
        }, function (e) {
            alert(e)

        });
    },
    // Hand off a new signal from the signaler to the connection
    _newSignal = function (partnerClientId, data, isVideoCall, force) {

        var signal = data,
            connection = _getConnection(partnerClientId, isVideoCall);

        // Route signal based on type
        if (signal.SDP) {
            _receivedSdpSignal(connection, partnerClientId, JSON.parse(signal.SDP), isVideoCall);
        } else if (signal.candidate) {
            _receivedCandidateSignal(connection, partnerClientId, JSON.parse(signal.candidate));
        }
    },
    _newSignalConference = function (partnerClientId, data, conferenceId) {
        console.log("why here");
        //var signal = data,
        //  connection = _getConnectionConference(partnerClientId, conferenceId);

        //// Route signal based on type
        //if (signal.SDP) {
        //    _receivedSdpSignalConference(connection, partnerClientId, signal.SDP);
        //} else if (signal.candidate) {
        //    _receivedCandidateSignal(connection, partnerClientId, signal.candidate);
        //}
    },
    // Process a newly received Candidate signal
    _receivedCandidateSignal = function (connection, partnerClientId, candidate) {
        // var candidate = JSON.parse(candidate);

        if (connection && candidate) {
            var _candidate = new RTCIceCandidate({
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMLineIndex,
                candidate: candidate.candidate
            });

            //var iceCandidate = new RTCIceCandidate(candidate);
            if (_candidate) {
                try {
                    connection.addIceCandidate(_candidate);
                } catch (e) {
                    //console.log(e);
                }
            }
        }
    },
    // Retreive an existing or new connection for a given partner
    _getConnection = function (partnerClientId, isVideoCall) {
        var connection = _connections[partnerClientId] || _createConnection(partnerClientId, isVideoCall);
        return _connections[partnerClientId];
    },

    _getThisConnection = function (partnerClientId) {
        var thisConnection = myConnections[partnerClientId] || _creteNewCaller(partnerClientId);
        return thisConnection;

    },
    _creteNewCaller = function (partnerClientId) {
        var thisCaller = { partnerClientId: partnerClientId, callingCount: 0 };
        myConnections[partnerClientId] = thisCaller;
        return thisCaller;
    },

    _getConnectionConference = function (partnerClientId, conferenceId) {
        var conference = _connections[conferenceId] || _createConference(conferenceId);
        var connection = conference[partnerClientId] || _createConnectionConference(partnerClientId, conferenceId);
        return connection;
    },
    _createConference = function (conferenceId) {
        _connections[conferenceId] = {};
        return _connections[conferenceId];
    },
    _endConference = function (conferenceId) {
        delete _connections[conferenceId];
    },
    _removeConnection = function (conferenceId) {
        _connections[conferenceId] && _connections[conferenceId].close();
        delete _connections[conferenceId];
    },

    _deleteMyConnections = function (connectionId, all) {
        delete myConnections[connectionId];
        if (all) {
            myConnections = {};
        }

    }
    // Close all of our connections
    _closeAllConnections = function () {
        myConnections = {};
        for (var connectionId in _connections) {
            _closeConnection(connectionId);
        }
        _deleteMyConnections();
    },
    _closeAllConnectionsConference = function (conferenceId) {
        for (var connectionId in _connections[conferenceId]) {
            _closeConnectionConference(conferenceId, connectionId);
        }
        delete _connections[conferenceId];
    },
    _closeConnectionConference = function (conferenceId, partnerClientId) {
        var connection = _connections[conferenceId][partnerClientId];

        if (connection) {
            // Let the user know which streams are leaving
            // todo: foreach connection.remoteStreams -> onStreamRemoved(stream.id)
            _onStreamRemovedConferenceCallback(null, partnerClientId, null);
            // Close the connection
            connection.close();
            delete _connections[conferenceId][partnerClientId]; // Remove the property
        }
    },

    // Close the connection between myself and the given partner
    _closeConnection = function (partnerClientId) {
        var connection = _connections[partnerClientId];
        if (connection) {
            // Let the user know which streams are leaving
            // todo: foreach connection.remoteStreams -> onStreamRemoved(stream.id)
            _onStreamRemovedCallback(connection, null);
            // Close the connection
            connection.close();
            delete _connections[partnerClientId]; // Remove the property
        }
    },
    // Send an offer for audio/video
    _initiateOffer = function (partnerClientId, stream, isVideoCall, force) {
        // Get a connection for the given partner
        var connection = _getConnection(partnerClientId, isVideoCall);
        var room = partnerClientId;
        var thisCaller = _getThisConnection(partnerClientId);
        thisCaller.callingCount++;
        // Add our audio/video stream
        var mystream = stream;
        if (mystream && connection.getLocalStreams().length < 1) {
            //connection.removeStream(stream);
            connection.addStream(stream);
        }
        // Send an offer for a connection
        connection.createOffer(function (desc) {
            //desc.sdp = desc.sdp.replace(/a=mid:audio\r\n/g, 'a=mid:audio\r\nb=AS:40\r\n');
            //desc.sdp = desc.sdp.replace('/48000/', '/8000/');
            //desc.sdp = modifySdp(desc.sdp);
            desc.sdp = preferBitRate(desc.sdp, 20, "audio");
            desc.sdp = BandwidthHandler.setOpusAttributes(desc.sdp, {
                'stereo': 0, // to disable stereo (to force mono audio)
                'sprop-stereo': 0,
                'maxaveragebitrate': 12000, 
                'maxplaybackrate': 8000,
                'cbr': 0, // disable cbr
                'useinbandfec': 1, // use inband fec
                'usedtx': 0, // use dtx
                'maxptime': 30,
                'sprop-maxcapturerate': 8000
            });
            //desc.sdp = preferBitRate(desc.sdp, 40, "audio")
            connection.setLocalDescription(desc, function () {
                // audio bandwidth 50 kilobits per second
                var sendData = {
                    room: user.classroom,
                    emailId: user.emailid,
                    target: 'audio',
                    type: 'offerSDP',
                    webRtcTarget: connection.parterId,
                    force: force,
                    payload: {
                        options: {
                            SDP: JSON.stringify(connection.localDescription)
                        }
                    }
                }
                socket.emit('message', sendData);
            }, function (err) {
                console.log(err);
            });
        }, function (err) {

            console.error(err);
        });
    },
    // Send an offer for audio/video

    _initiateConferenceOffer = function (partnerClientId, stream, conferenceId) {
        // Get a connection for the given partner
        var connection = _getConnectionConference(partnerClientId, conferenceId);
        // Add our audio/video stream
        connection.addStream(stream);
        // Send an offer for a connection
        connection.createOffer(function (desc) {
            connection.setLocalDescription(desc, function () {
            });
        });
    }

    function modifySdp(sdp) {
        //sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');
        //sdp.replace(/a=mid:audio\r\n/g, 'a=mid:audio\r\n b=AS:40\r\n');
        //sdp.replace('opus/48000/2', 'opus/8000/2');
        //sdp.replace("audio", 'voice');
        //sdp.replace('a=maxptime:60', "a=maxptime:40");
        return preferBitRate(sdp, 20, "audio");


    }

    function preferBitRate(sdp, bitrate, mediaType) {
        var sdpLines = sdp.split("\r\n");
        var mLineIndex = findLine(sdpLines, "m=", mediaType);
        if (mLineIndex === null) {
            //trace("Failed to add bandwidth line to sdp, as no m-line found");
            return sdp;
        }
        var nextMLineIndex = findLineInRange(sdpLines, mLineIndex + 1, -1, "m=");
        if (nextMLineIndex === null) {
            nextMLineIndex = sdpLines.length;
        }
        var cLineIndex = findLineInRange(sdpLines, mLineIndex + 1, nextMLineIndex, "c=");
        if (cLineIndex === null) {
            //trace("Failed to add bandwidth line to sdp, as no c-line found");
            return sdp;
        }
        var bLineIndex = findLineInRange(sdpLines, cLineIndex + 1, nextMLineIndex, "b=AS");
        if (bLineIndex) {
            sdpLines.splice(bLineIndex, 1);
        }
        var bwLine = "b=AS:" + bitrate;
        sdpLines.splice(cLineIndex + 1, 0, bwLine);
        sdp = sdpLines.join("\r\n");
        return sdp;
    }

    function findLine(sdpLines, prefix, substr) {
        return findLineInRange(sdpLines, 0, -1, prefix, substr);
    }
    function findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
        var realEndLine = endLine !== -1 ? endLine : sdpLines.length;
        for (var i = startLine; i < realEndLine; ++i) {
            if (sdpLines[i].indexOf(prefix) === 0) {
                if (!substr || sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
                    return i;
                }
            }
        }
        return null;
    }



    // Return our exposed API
    return {
        _connections: _connections,
        initialize: _initialize,
        newSignal: _newSignal,
        closeConnection: _closeConnection,
        closeAllConnections: _closeAllConnections,
        initiateOffer: _initiateOffer,
        initiateConferenceOffer: _initiateConferenceOffer,
        newSignalConference: _newSignalConference,
        createConference: _createConference,
        endConference: _endConference,
        closeAllConnectionsConference: _closeAllConnectionsConference,
        closeConnectionConference: _closeConnectionConference,
        removeConnection: _removeConnection,
        deleteMyConnections: _deleteMyConnections

    };

})();