(function () {
  'use strict';
  var canvasId = "canvasuiele";
  var socket,canvas ;
  $(document).ready(documentReadyCallback);
  function documentReadyCallback(){
    
    connectSocket();
    initCanvas();
  }
  function connectSocket(){
     socket = io();
     registersocketCallBack(socket);
     
  }
  function registersocketCallBack(s){
     s.on('joined', function (userInfo, clientId) {
         alert("Join")
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
        onSocketMessage_audio(message);
        break;
        default:
        break;
      
         }
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
      switch (message.type) {
        case "path":
        addpathCanvas(message);
        break;
        default:
        break;
            }
  }
  function initCanvas(){
      canvas = new fabric.Canvas(canvasId, {
      perPixelTargetFind: true,
            targetFindTolerance: 5,
      });
      
      attachCanvasCallbacks(canvas)
      canvas.isDrawingMode = true;
  }
  
  function attachCanvasCallbacks(canvas) {
        canvas.on("object:removed", function (obj, event) {
            if (!obj.target.isTemp && obj.target.id) {

                var sendData = {
                    room: room,
                    messageId: null,
                    event: 'canvas',
                    subEvent: 'deleteObject',
                    payload: {
                        options: { id: obj.target.id, "class": obj.target.type }
                    }
                }
                socket.emit('message', sendData);
            }
        });
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
                room: user.classRoom,
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
        
 //
    
 
  
})();
