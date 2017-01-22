const restify = require('restify');
const raspi = require('raspi');
const gpio = require('raspi-gpio');

const config = require('./config.json');
const server = restify.createServer();

let relays;

server.use(restify.bodyParser({maxBodySize: 1000}));

raspi.init(function() {
  relays = config.relays.map(createRelay);
});

process.on('SIGINT', () => {
  relays.map(relay => destroyRelay(relay));
  relays = [];
  server.close();
  console.log('Waiting for all clients to finish their requests...');
});

server.get('/relay', function(req, res) {
  let result = {};
  
  relays.forEach((x, i) => {
    result[i] = {};
    result[i].state = x.state;
  });

  res.send(200, result);
});

const methods = {0: turnRelayOff, 1: turnRelayOn};
server.put('/relay/:id', function(req, res) {
  const relayId = +req.params.id;

  if (!relays.hasOwnProperty(relayId)) {
    return res.send(404);
  }

  if (typeof req.body.state !== 'number' || !~[gpio.LOW, gpio.HIGH].indexOf(req.body.state)) {
    return res.send(400);
  }

  methods[req.body.state](relays[relayId]);
  res.send(200);
});
 
server.listen(process.env.PORT, function() {
  console.log('%s listening at %s', server.name, server.url);
});


// Encapsulation of a low-trigger relay
function createRelay(pinNumber) {
  const pin = `P1-${pinNumber}`;
  const output = new gpio.DigitalOutput(pin);
  output.write(gpio.HIGH);
  return {pin, output, state: 0};
}

function destroyRelay(relay) {
  new gpio.DigitalInput({pin: relay.pin, pullResistor: gpio.PULL_UP});
}

function turnRelayOff(relay) {
  console.log(`Setting relay ${relay.pin} to 0`);
  relay.output.write(gpio.HIGH);
  relay.state = 0;
  return relay;
}

function turnRelayOn(relay) {
  console.log(`Setting relay ${relay.pin} to 1`);
  relay.output.write(gpio.LOW);
  relay.state = 1;
  return relay;
}

