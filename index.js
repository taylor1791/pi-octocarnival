const restify = require('restify');
const raspi = require('raspi');
const gpio = require('raspi-gpio');
const {writeFile} = require('fs');

const config = require('./config.json');
const server = restify.createServer();

let relays;
let activity;

server.use(restify.bodyParser({maxBodySize: 1000}));
server.use(function(req, res, next) {
  next();
  activity.write(gpio.HIGH);
  setTimeout(function() {
    activity.write(gpio.LOW);
  }, 75);
  return;
});

raspi.init(function() {
  relays = config.relays.map(createRelay);
  activity = new gpio.DigitalOutput(`P1-${config.activity}`);
  activity.write(gpio.LOW);
  console.log(`Starting up at ${new Date()}...`);
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

  writeFile('./config.json', JSON.stringify(config), {}, function(err) {
    if (err) console.error(err);
  });
});
 
server.listen(process.env.PORT || 8000, function() {
  console.log('%s listening at %s', server.name, server.url);
});


// Encapsulation of a low-trigger relay
function createRelay(pinNumber, index) {
  const pin = `P1-${pinNumber}`;
  const output = new gpio.DigitalOutput(pin);
  methods[config.status[index]]({output, pin});
  return {pin, output, state: config.status[index], index};
}

function destroyRelay(relay) {
  new gpio.DigitalInput({pin: relay.pin, pullResistor: gpio.PULL_UP});
}

function turnRelayOff(relay) {
  console.log(`Setting relay ${relay.pin} to 0`);
  relay.output.write(gpio.HIGH);
  config.status[relay.index] = 0;
  relay.state = 0;
  return relay;
}

function turnRelayOn(relay) {
  console.log(`Setting relay ${relay.pin} to 1`);
  relay.output.write(gpio.LOW);
  config.status[relay.index] = 1;
  relay.state = 1;
  return relay;
}

