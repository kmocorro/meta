let bodyParser = require('body-parser');
let verifyToken = require('../auth/verifyToken');
let uuidv4 = require('uuid/v4');
let jwt = require('jsonwebtoken');
let config = require('../auth/config');
let formidable = require('formidable');
let XLSX = require('xlsx');
let mysql = require('../db/dbConfig');

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
    app.get('/coa/qa', verifyToken, function(req, res){
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

    /** kiting boxid upload */
    app.get('/coa/kitting', verifyToken, function(req, res){
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
            res.render('kitting', {username: req.claim.username, department: req.claim.department, authenticity_token});
        } else {
            res.redirect('login');
        }
    })

    /** submit coa form + file */
    app.post('/api/coa', verifyToken, function(req, res){

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

                let workbook = XLSX.readFile(excelFile.path);

            }


        });



    });

    /** submit coa kitting form */
    app.post('/api/coakitting', verifyToken, function(req, res){
        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields){
            if(err){ return res.send({err: 'Invalid form. Try again'})};

            if(fields){
                let cleaned_tags = []; // expose in lexical environment for credentials variable

                let uncleaned_tags = [
                    fields.runcard1 || null,
                    fields.runcard2 || null,
                    fields.runcard3 || null,
                    fields.runcard4 || null 
                ]

                for(let i=0; i<uncleaned_tags.length;i++){ // dont push NULL to cleaned array 
                    if(uncleaned_tags[i]){
                        cleaned_tags.push(
                            uncleaned_tags[i]
                        );
                    }
                }

                let credentials = { // cleaned json
                    uid: req.userID,
                    upload_date: new Date(),
                    authenticity_token: fields.authenticity_token,
                    boxid: fields.boxid,
                    tags: cleaned_tags
                }

                //  verify token
                function verifyLinkToken(){
                    return new Promise(function(resolve, reject){

                        jwt.verify(credentials.authenticity_token, config.secret, function(err, decoded){
                            if(err){ return reject(err)};

                            resolve();

                        });

                    });
                }

                // load database
                mysql.pool.getConnection(function(err, connection){
                    if(err){return res.send({err: 'Cannot connect to database'})};

                    function checkUser(){ // resolve username
                        return new Promise(function(resolve, reject){

                            connection.query({
                                sql: 'SELECT * FROM deepmes_auth_login WHERE id=?',
                                values: [credentials.uid]
                            },  function(err, results){
                                if(err){return reject(err)};

                                if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){
                                    let verified_username = results[0].username;
                                    resolve(verified_username);
                                } else {
                                    reject();
                                }
                            });

                        });
                    }

                    function isBoxIdExists(){ // check if box id exists
                        return new Promise(function(resolve, reject){

                            connection.query({
                                sql: 'SELECT * FROM tbl_coa_box WHERE box_id = ?',
                                values: [credentials.boxid]
                            },  function(err, results){
                                if(err){return reject(err)};

                                if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){
                                    let boxidTaken = 'Box Id already exists.';
                                    reject(boxidTaken);
                                } else {
                                    resolve();
                                }

                            });

                        });
                    }

                    // invoker
                    verifyLinkToken().then(function(){
                        return checkUser().then(function(verified_username){
                            return isBoxIdExists().then(function(){

                                function credentialsToDB(){ // insert to database
                                    return new Promise(function(resolve, reject){

                                        for(let i=0;i<credentials.tags.length;i++){ // loop through tags

                                            connection.query({
                                                sql: 'INSERT INTO tbl_coa_box SET upload_date=?, box_id=?, runcard=?, username=?',
                                                values: [credentials.upload_date, credentials.boxid, credentials.tags[i], verified_username]
                                            },  function(err, results){
                                                if(err){return reject(err)};
                                                
                                                resolve();
                
                                            });

                                        }

                                    });
                                }

                                return credentialsToDB().then(function(){

                                    connection.release(); 
                                    res.send({auth: 'Form saved.'});

                                },  function(err){
                                    res.send({err: err});
                                });
                            }, function(err){
                                res.send({err: err});
                            });
                        },  function(err){
                            res.send({err: err});
                        });
                    }, function(err){
                        res.send({err: err});
                    });

                
                });

            }


        });
    })

}