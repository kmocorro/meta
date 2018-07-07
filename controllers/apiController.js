let bodyParser = require('body-parser');
let verifyToken = require('../auth/verifyToken');
let uuidv4 = require('uuid/v4');
let jwt = require('jsonwebtoken');
let config = require('../auth/config');

module.exports = function(app){
    // parse out json and app can handle url requests
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    /**
     * API: GET
     * Access: Home
     * View: index, signin
     * Required: auth token
     * @param {userID, claim} verifyToken
     * @param {firstname, department} res
     */

    app.get('/', verifyToken, function(req, res){
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');

        if(req.userID && req.claim){
            res.render('index', {username: req.claim.username, department: req.claim.department});
        } else {
            res.redirect('login');
        }

    });

    /** Sign up page */
    app.get('/signup', function(req, res){

        let authenticity_token = jwt.sign({
            id: uuidv4(),
            claim: {
                signup: 'valid'
            }
        }, config.secret, { expiresIn: 300 });

        res.render('signup', {authenticity_token});
    });



}