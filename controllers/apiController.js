let bodyParser = require('body-parser');
let verifyToken = require('../auth/verifyToken');
let uuidv4 = require('uuid/v4');
let jwt = require('jsonwebtoken');
let config = require('../auth/config');
let formidable = require('formidable');
let XLSX = require('xlsx');

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

    /** coa */
    app.get('/coa', verifyToken, function(req, res){
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');

        let authenticity_token = jwt.sign({
            id: uuidv4(),
            claim: {
                signup: 'valid'
            }
        }, config.secret);

        if(req.userID && req.claim){
            res.render('coa', {username: req.claim.username, department: req.claim.department, authenticity_token});
        } else {
            res.redirect('login');
        }

    });

    /** submit coa form + file */
    app.post('/api/coa', function(req, res){

        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields, file){
            if(err){ return res.send({err: 'Invalid form. Try again'})};

            if(fields && file){

                let excelFile = {
                    date_upload: new Date(),
                    path: file.coafile.path,
                    name: file.coafile.name,
                    type: file.coafile.type,
                    date_modified: file.coafile.lastModifiedDate
                }

                let workbook = XLSX.readFile(excelFile.path,{cellText: true});

            }


        });



    });



}