const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const client = require('prom-client');

// required 
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
const BAD_REQUEST = 500;
const PORT = 5000;
/*
curl -X GET \
 -H "Accept:text/event-stream" \
 -d '{"apiKey":240, "id":1}'\
 -s http://localhost:3001/listen

curl -X GET -H "Accept:text/event-stream" 'http://localhost:5000/listen?id=1'

curl -G -H "Accept:text/event-stream" -d "apiKey=240" -d "id=1" -d "name=Josh" 'http://localhost:5000/listen'

curl -X GET \
 -H "Content-Type: application/json" \
 -H "Accept: text/event-stream" \
 -d '{"apiKEY": 240, "id": 2}'\
 -s http://localhost:8000/listen

 curl -X POST \
 -H "Content-Type: application/json" \
 -d '{"apiKey": 240, "id": 1, "message":"this is a message", "name":"Josh"}'\
 -s http://localhost:5000/send
 */


/*
    to keep track of clients in the room.
    if client[id] == null, chat room has not been initalized yet
    if client[id] == [], chat room is initialized and clients' res is in there.
*/

let clients = {};
let messages = 0;
let chatrooms = 0;

const messageGauge = new client.Gauge({
    name: 'messages',
    help: 'number of messages sent',
    async collect() {
      // Invoked when the registry collects its metrics' values.
      this.set(messages);
    },
  });
  
const chatroomGauge = new client.Gauge({
  name: 'chatrooms',
  help: 'number of chatrooms open',
  async collect() {
    // Invoked when the registry collects its metrics' values.
    this.set(chatrooms);
  },
});  
/**
 * takes a JSON
 *     {apiKey: ####, id: ###, name: ###}
 *     apiKey for auth
 *     id for chat room
 * on close:
 *     scrub through dictionary and corresponding array
 *     remove res
 */
app.get('/listen', (request, response) => {
    const { apiKey, id, name } = request.query;
    if (!id) { return response.status(BAD_REQUEST).send('Chatroom ID is required'); }
    if (!name) { return response.status(BAD_REQUEST).send('Name is required'); }
    if (!apiKey) { return response.status(BAD_REQUEST).send('API Key is required'); }

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    if(!clients[id]) {
        clients[id] = [];
        chatrooms++;
    }

    clients[id].push({ id: name, response });
    request.on('close', () => {
        console.log(`${name} connection closed on room ${id}`);
        clients = clients[id].filter(client => client.response !== response);
        if(!clients[id]) { chatrooms--; }
      });
})




// write function
const sendMessageToChatroom = (chatroomId, message, name) => { 
    if (clients[chatroomId]) {
        clients[chatroomId].forEach(client => {
            if(client.id === name) {
                client.response.write(`data: ${JSON.stringify(message)}\n\n`);
                messages++;
            }
        })
        //clients[chatroomId].forEach(client => client.response.write(`data: ${JSON.stringify(message)}\n\n`));
    }
};
app.post('/send', (request, response) => {
    const { apiKey, id, message, name } = request.body;
    if(!message) { return response.status(BAD_REQUEST).send('Cannot send an empty message'); }
    if(!apiKey) { return response.status(BAD_REQUEST).send('must send a valid api key'); }
    if(!id) { return response.status(BAD_REQUEST).send('must send a valid id'); }
    if(!name) { return response.status(BAD_REQUEST).send('please enter your name'); }
    sendMessageToChatroom(id, message, name);
    response.send( {"message" : "sent"} );
    // validation
    // checkValid(apiKey);
    // else response.send('invalid api key');
})

app.get('/metrics', async (request, response) => {
    response.set('Content-Type', client.register.contentType);
    response.end(await client.register.metrics());
})

/* sample code
const sendEventsToAll = (newFact) => { clients[0].forEach(client => client.response.write(`data: ${JSON.stringify(newFact)}`)) };
app.post('/facts', (request, response) => {
    console.log(request.body);
    const newFact = request.body;
    facts.push(newFact);
    sendEventsToAll(newFact);
    console.log('facts reached');
    response.send( {"message": "sent"} );
})








app.get('/events', (request, response) => { 
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    };
    response.writeHead(200, headers);

    const data = `data: ${JSON.stringify(facts)}\n\n`;

    response.write(data);

    const clientId = Date.now();

    const newClient = {
      id: clientId,
      response
    };

    clients[0] = newClient;

    request.on('close', () => {
      console.log(`${clientId} Connection closed`);
      clients = clients.filter(client => client.id !== clientId);
    });
})
 */

app.get('/', (request, response) => {
    response.send("hello gang");
})

app.listen(PORT, () => {
    console.log(`Started server, Listening on port ${PORT}.`);
})