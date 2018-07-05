let express = require('express');
let app = express();
let cookieParser = require('cookie-parser');
let apiController = require('./controllers/apiController');
let authController = require('./auth/authController');

let port = process.env.PORT || 7070;

app.use('/', express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

app.use(cookieParser());
authController(app);
apiController(app);

app.listen(port);