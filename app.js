let express = require('express');
let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);

let cookieParser = require('cookie-parser');
let apiController = require('./controllers/apiController');
let socketController = require('./controllers/socketController');
let authController = require('./auth/authController');

let port = process.env.PORT || 7070;

app.use('/', express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

app.use(cookieParser());
authController(app);
apiController(app);
socketController(io);

//app.listen(port);
server.listen(port);