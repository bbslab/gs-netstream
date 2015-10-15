var SERVER_IP = "127.0.0.1";

var http = require('http')
    , express = require('express')
    , app = express()
    , fs = require('fs')
    , WebSocketServer = require('ws').Server
    , WebSocket = require('ws')
    , sourceID = "nodeServer"
    , timeID = 0
    , net = require('net')
    , netstream = {}
    , queue=[]
    , gs_comm_initiated=false
    , clients=[]
    , gs_client=null;

netstream.constants = require("../netstream_constants").netstream.constants;
netstream.sender = require("../netstream_sender").netstream.sender;




//
// Classical Http server to serve the files...
//
app.use(express.static('.'));
app.use(express.static('../'));
app.listen(8080, function(){console.log('Http Server running. go to  http://127.0.0.1:8080/testApp.html')});



// back server to receive and broadcast events from GS to the clients
var gs_server = net.createServer(function(c) {
  //console.log('gs_server connected');
  c.on('end',
  function() {
    //console.log('gs_server disconnected');
  });
  c.on("data",
  function(data) {
    clients.forEach(function(ws){
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  });
});

gs_server.listen(2000, function() {
  //'listening' listener
  //console.log('gs_server bound');
});





var wss = new WebSocketServer({
  port: 2003,
  host: SERVER_IP
});
wss.on('error',
function() {
  console.log('WS error....');
});
wss.on('connection',
function(ws) {

  // create a response server for gs. Random (free) port
  // let's get a graph...
  var events_server = net.createServer(function(c) {
    //console.log('events_server connected');
    c.on('end',
    function() {
      //console.log('events_server disconnected');
    });
    c.on("data",
    function(data) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  });
  events_server.listen(function() {
    //'listening' listener
    //console.log('events_server bound');
  });
  var events_server_port = events_server.address().port;


  // ask GS for a replay
  var tmp_gs_client = net.connect(2001,
  function() {
    //'connect' listener
    console.log('tmp_gs_client connected');
    tmp_gs_client.write("" + events_server_port);
    tmp_gs_client.end();
  });
  tmp_gs_client.on('end',
  function() {
    console.log('tmp_gs_client disconnected');
  });




  // this client closes the connection
  ws.on('close',
  function() {
  });


  // this client sends somthing to GS
  ws.on('message',
  function(message) {
    if (message === "Heartbeat"){
      //console.log('Heartbeating...');
    }
    else{
      console.log('received from WS');
      if(!gs_comm_initiated){
        gs_comm_initiated=true;
        do_gs_client();
      }
      if ( gs_client === null || typeof gs_client ==="undefined" ){
        console.log('queuing message (client undefined )');
        
        queue.push(message);
      }
      else if (gs_client.readyState !== 'open'){
            console.log(gs_client.readyState);
            console.log('queuing message (client opening)');
            queue.push(message);
      } else{
        //console.log('directly passing  msg to GS : %s', message);
        gs_client.write(message);
      }
    }
  });
});




function do_gs_client(callback){
  // one connection from node to GS'receiver
  gs_client = net.connect(2002, function() { //'connect' listener
    console.log('dequeuing messages');
    for(var i=0; i<queue.length; i++){
      this.write(queue[i]);
    }
    delete queue;
  });
  gs_client.on('data', function(data) {
    //console.log("from gs_client: "+data.toString());
  });
  gs_client.on('end', function() {
    //console.log('gs_client disconnected');
    gs_comm_initiated=false;
  }); 
}



