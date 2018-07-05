let jwt = require('jsonwebtoken');
let bodyParser = require('body-parser');
let config = require('./config');
let formidable = require('formidable');
let bcrypt = require('bcryptjs');
let uuidv4 = require('uuid/v4');
let nodemailer = require('nodemailer');

let mysql = require('../db/dbConfig');

module.exports = function(app){

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    /** GET API for user LOGIN PAGE */
    app.get('/login', function(req, res){
        res.render('login');
    });

    /** POST API for user login */
    app.post('/api/login', function(req, res){
        let form = new formidable.IncomingForm();
        
        // parse incoming form
        form.parse(req, function(err, fields, files){
            if(err){ return res.send({err: 'Form parse error.' })};

            if(fields){
                let form_login_details = fields;

                if(form_login_details.username && form_login_details.password){

                    let credentials = {
                        username: form_login_details.username,
                        pass: form_login_details.password
                    };

                    // connect to database
                    mysql.pool.getConnection(function(err, connection){
                        if(err){ return res.send({err: 'Database pool error.'})};

                        connection.query({
                            sql: 'SELECT * FROM deepmes_auth_login WHERE username=?',
                            values: [credentials.username]
                        },  function(err, results, fields){
                            if(err){ return res.send({err: 'Login query error'})};
                    
                            if(results){
                                try{
                                    let result_password = results[0].password;
                                    let isPasswordValid = bcrypt.compareSync(credentials.pass, result_password);

                                    if(isPasswordValid){
                                        
                                        // sign auth token
                                        let token = jwt.sign({
                                            id: results[0].id,
                                            claim: {
                                                username: results[0].username,
                                                name: results[0].name,
                                                email: results[0].email,
                                                department: results[0].department
                                            }
                                        }, config.secret); // expiresIn: sometime

                                        res.cookie('auth', token); // send cookie auth token
                                        res.status(200).send({auth: 'Authenticated. Please wait...'});

                                    } else {
                                        res.send({err: 'Password does not match.'});
                                    }

                                } catch(error){
                                    res.send({err: 'Invalid username or password.'});
                                }
                            }

                        });

                        connection.release();

                    });

                }

            }

        });
    });

}