let jwt = require('jsonwebtoken');
let bodyParser = require('body-parser');
let config = require('./config');
let formidable = require('formidable');
let bcrypt = require('bcryptjs');
let uuidv4 = require('uuid/v4');
let nodemailer = require('nodemailer');
let mailer = require('../mail/config');
let approver = require('../mail/signupAdmin');

let mysql = require('../db/dbConfig');

module.exports = function(app){

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    /** Nodemailer transporter config */
    let transporter = nodemailer.createTransport(mailer.mail);

    /** GET API for user LOGIN PAGE */
    app.get('/login', function(req, res){

        let authenticity_token = jwt.sign({
            id: uuidv4(),
            claim: {
                signup: 'valid'
            }
        }, config.secret, { expiresIn: 300 });

        res.render('login', {authenticity_token});
    });

    /** GET API for user LOGOUT PAGE */
    app.get('/logout', function(req, res){
        res.cookie('auth', null);
        res.render('logout');
    });

    /** GET API for forgotpassword */
    app.get('/forgotpassword', function(req, res){
        let authenticity_token = jwt.sign({
            id: uuidv4(),
            claim: {
                signup: 'valid'
            }
        }, config.secret, { expiresIn: 300 });

        res.render('forgotpassword', {authenticity_token});
    });

    /** GET API for verifysignup link */
    app.get('/verifysignup', function(req, res){

        let verificationLink = req.query.token;

        if(verificationLink){

            //  verify token
            function verifyLinkToken(){
                return new Promise(function(resolve, reject){

                    jwt.verify(verificationLink, config.secret, function(err, decoded){
                        if(err){ return res.status(200).render('verifysignup_expired')};

                        let verifiedClaim = decoded.claim;

                        resolve(verifiedClaim);

                    });

                });
            }

            verifyLinkToken().then(function(verifiedClaim){

                //  save to database as valid user signed up
                mysql.pool.getConnection(function(err, connection){
                    if(err){return  res.send({err: 'Database error at verify signup'})};
                    
                    // check if user exists,
                    connection.query({
                        sql: 'SELECT * FROM deepmes_auth_login WHERE username=? AND email=?',
                        values:[verifiedClaim.username, verifiedClaim.email]
                    },  function(err, results){
                        if(err){return res.send({err: 'Error query to database at verify signup'})};

                        if(typeof results != 'undefined' && results != null && results.length != null && results.length > 0){
                            
                            res.render('verifysignup_expired', {email: verifiedClaim.email});

                        } else {
                            
                            // if doesnt, safe to insert to db.
                            connection.query({
                                sql: 'INSERT INTO deepmes_auth_login SET registration_date=?, username=?, name=?, email=?, department=?, password=?',
                                values: [verifiedClaim.date, verifiedClaim.username, verifiedClaim.firstname + ' ' + verifiedClaim.lastname, verifiedClaim.email, verifiedClaim.department, verifiedClaim.password ]
                            },  function(err, results){
                                if(err){return res.send({err: 'Error inserting to database at verify signup'})};

                                // send email notification.
                                let mailSettings = {
                                    from: '"Automailer" <' + mailer.mail.auth.user + '>',
                                    to: verifiedClaim.email,
                                    subject: 'Welcome to META!',
                                    html: '<p>Hello ' + verifiedClaim.firstname + ', <br><br> Thanks for joining META! <br><br>You may now use your username <b>'+ verifiedClaim.username +'</b> to upload your activites, view reports and more. <br><br>To continue to META, Here\'s the link: http://'+ approver.admin.ip +' <br><br> Thanks </p>'
                                }

                                transporter.sendMail(mailSettings, function(error, info){
                                    if(error){ return res.send({err: '<center>Oops, there is a problem folding the email.<br> Please try it again. </center>'})};
                                    res.render('verifysignup_success', {email: verifiedClaim.email});
                                });
        
                                
                            });
                        }

                    });

                    connection.release();
                });

            });

        }

    });

    /** GET API for reset password */
    app.get('/reset', function(req, res){
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');

        let resetLinkToken = req.query.token;

        if(resetLinkToken){

            //  verify token then attach as hidden authenticity token 
            function verifyLinkToken(){
                return new Promise(function(resolve, reject){

                    jwt.verify(resetLinkToken, config.secret, function(err, decoded){
                        if(err){ return res.status(200).render('verifyreset_expired')};

                        let verifiedEmail = decoded.claim.email;
                        resolve(verifiedEmail);

                    });

                });
            }

            verifyLinkToken().then(function(verifiedEmail){

                res.render('resetpassword', {authenticity_token: resetLinkToken, verifiedEmail});

            });

        }

    });

    /** GET API for reset password successfully */
    app.get('/resetsuccessfully', function(req, res){
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        
        let basicToken_cookie = req.cookies.basicToken_cookie;
        if(!basicToken_cookie) { return res.status(200).render('login') };
        
        jwt.verify(basicToken_cookie, config.secret, function(err, decoded){
            if(err) return res.status(200).render('login');
    
            let email = decoded.claim.email;
            
            res.cookie();

            res.render('verifyreset_success', {email});
            
        });
    });

    /** POST API for user SIGN UP */
    app.post('/api/register', function(req, res){
        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields){
            if(err){ return res.send({err: 'Invalid form. Try again.'})}

            if(fields){

                if(fields.department == 'Engineering' || fields.department == 'Manufacturing' || fields.department == 'Yield'){

                    // verify authenticity_token from fields
                    let token = fields.authenticity_token;
                    
                    if(!token){
                        res.send({err: 'Invalid signup.'});
                    } else {

                        // check ifTokenValid
                        function isTokenValid(){
                            return new Promise(function(resolve, reject){

                                jwt.verify(token, config.secret, function(err, decoded){
                                    if(err){ return res.render('signup') };

                                    let isSignUpValidToken = decoded.claim;

                                    if(isSignUpValidToken.signup == 'valid'){
                                        resolve(isSignUpValidToken);
                                    } else {
                                        let invalidToken = 'Invalid';
                                        reject(invalidToken);
                                    }

                                });

                            });
                        }

                        // check if Username is taken
                        function isUsernameTaken(){
                            return new Promise(function(resolve, reject){
                                mysql.pool.getConnection(function(err, connection){
                                    if(err){return reject(err)};
                                    
                                    connection.query({
                                        sql: 'SELECT username FROM deepmes_auth_login WHERE username=?',
                                        values: [fields.username]
                                    },  function(err, results){
                                        if(err){return reject(err)};
                                        
                                        if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){
                                            let usernameTaken = 'Username is already taken.';
                                            reject(usernameTaken);
                                        } else {
                                            resolve();
                                        }

                                    });

                                    connection.release();

                                });
                            });
                        }

                        // check if Email is taken
                        function isEmailTaken(){
                            return new Promise(function(resolve, reject){
                                mysql.pool.getConnection(function(err, connection){
                                    if(err){return reject(err)};

                                    connection.query({
                                        sql: 'SELECT email FROM deepmes_auth_login WHERE email=?',
                                        values: [fields.email+'@sunpowercorp.com']
                                    },  function(err, results){
                                        if(err){return reject(err)};

                                        if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){
                                            let emailTaken = 'Email is already taken.';
                                            reject(emailTaken);
                                        } else {
                                            resolve();
                                        }

                                    });

                                    connection.release();

                                });
                            });
                        }

                        isTokenValid().then(function(isSignUpValidToken){

                            let hashBrown = bcrypt.hashSync(fields.password);

                            let signup_credentials = {
                                token: isSignUpValidToken,
                                date: new Date(),
                                firstname: fields.firstname,
                                lastname: fields.lastname,
                                username: fields.username,
                                email: fields.email + '@sunpowercorp.com',
                                department: fields.department,
                                password: hashBrown
                            }

                            return isUsernameTaken().then(function(){
                                return isEmailTaken().then(function(){

                                    // safe to signup, send verification link via email
                                    let signupVerificationToken = jwt.sign({
                                        id: uuidv4(),
                                        claim: signup_credentials
                                    }, config.secret, {expiresIn: 432000}); // 5 days? expiry
                                    
                                    // mail settings
                                    let mailSettings = {
                                        from: '"Automailer" <' + mailer.mail.auth.user + '>',
                                        to: approver.admin.email,
                                        subject: 'Verify Email Address for META',
                                        html: '<p>Hey ' + approver.admin.name + ', <br><br> As an admintrator of META, We\'d like to know if you want to accept <b>' + signup_credentials.email + '</b> as a new user. <br><br><table style="border: 1px solid gray; padding:2px;"><tr ><th style="border: 1px solid gray; padding:2px;">Firstname</th><th style="border: 1px solid gray; padding:2px;">Lastname</th><th style="border: 1px solid gray; padding:2px;">Username</th><th style="border: 1px solid gray; padding:2px;">Email</th><th style="border: 1px solid gray; padding:2px;">Department</th></tr><tr><td style="border: 1px solid gray; padding:2px;">'+ signup_credentials.firstname +'</td><td style="border: 1px solid gray; padding:2px;">'+ signup_credentials.lastname +'</td><td style="border: 1px solid gray; padding:2px;">'+ signup_credentials.username +'</td><td style="border: 1px solid gray; padding:2px;">'+ signup_credentials.email +'</td><td style="border: 1px solid gray; padding:2px;">'+ signup_credentials.department +'</td></tr></table><br>Click below to verify the email address: <br><br><a href="http://' + approver.admin.ip + '/verifysignup?token=' + signupVerificationToken + '" target="_blank">Verify Email Address</a>. <br><br> If you don\'t want to accept, just ignore this email. <br><br> Thanks! </p>'
                                    }

                                    transporter.sendMail(mailSettings, function(error, info){
                                        if(error){ return res.send({err: '<center>Oops, there is a problem folding the email.<br> Please try it again. </center>'})};
                                        res.send({auth: '<center>Success!<br> We\'ll send an email once account has been approved.</center>'});
                                    });


                                }, function(err){
                                    if(err){ return res.send({err: err})};
                                });

                            }, function(err){
                                if(err){ return res.send({err: err})};
                            });
                            
                        },function(invalidToken){
                            res.send({err: invalidToken + ' token.'});
                        });

                    }

                } else {
                    res.send({err: 'Invalid department.'});
                }

            }

        });

    });

    /** POST API for user login */
    app.post('/api/login', function(req, res){
        let form = new formidable.IncomingForm();
        
        // parse incoming form
        form.parse(req, function(err, fields, files){
            if(err){ return res.send({err: 'Form parse error.' })};
            
            if(fields){
                let form_login_details = fields;

                if(form_login_details.authenticity_token && form_login_details.username && form_login_details.password){

                    // verify authenticity_token from fields
                    let token = fields.authenticity_token;

                    if(!token){
                        res.send({err: 'Invalid login'});
                    } else {

                        // check ifTokenValid
                        function isTokenValid(){
                            return new Promise(function(resolve, reject){

                                jwt.verify(token, config.secret, function(err, decoded){
                                    if(err){ reject('Invalid') };

                                    let isSignUpValidToken = decoded.claim;

                                    if(isSignUpValidToken.signup == 'valid'){
                                        resolve();
                                    } else {
                                        let invalidToken = 'Invalid';
                                        reject(invalidToken);
                                    }

                                });

                            });
                        }

                        isTokenValid().then(function(){

                            let credentials = {
                                username: form_login_details.username,
                                pass: form_login_details.password
                            };
        
                            // connect to database
                            mysql.pool.getConnection(function(err, connection){
                                if(err){ return res.send({err: 'Database pool error at login.'})};
        
                                connection.query({
                                    sql: 'SELECT * FROM deepmes_auth_login WHERE username=?',
                                    values: [credentials.username]
                                },  function(err, results){
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
                                                console.log(credentials.username + ' has logged in.');
        
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

                        }, function(err){
                            if(err){return res.send({err: err + ' token.'})};
                        })


                    }



                }

            }

        });
    });

    /** POST API for user forgotpassword */
    app.post('/api/forgotpassword', function(req, res){
        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields, files){
            if(err){ return res.send({err: 'Invalid email submission. Please try again.'})};

            if(fields.authenticity_token && fields.email){

                // verify authenticity_token from fields
                let token = fields.authenticity_token;

                if(!token){
                    res.send({err: 'Invalid login'});
                } else {

                    // check ifTokenValid
                    function isTokenValid(){
                        return new Promise(function(resolve, reject){

                            jwt.verify(token, config.secret, function(err, decoded){
                                if(err){ return res.render('forgotpassword') };

                                let isSignUpValidToken = decoded.claim;

                                if(isSignUpValidToken.signup == 'valid'){
                                    resolve();
                                } else {
                                    let invalidToken = 'Invalid';
                                    reject(invalidToken);
                                }

                            });

                        });
                    }

                    isTokenValid().then(function(){

                        console.log(fields.email);
                        let forgettenEmail = fields.email + '@sunpowercorp.com';

                        // check user db if exists.
                        mysql.pool.getConnection(function(err, connection){
                            if(err){return res.send({err: 'Database error.'})};
                            
                            connection.query({
                                sql: 'SELECT * FROM deepmes_auth_login WHERE email=?',
                                values: [forgettenEmail]
                            },  function(err, results){
                                if(err){return res.send({err: 'Query email error.'})};
                                
                                if(typeof results != 'undefined' && results != null && results.length != null && results.length > 0){

                                    let payload = {
                                        uuid: uuidv4(),
                                        id: results[0].id,
                                        email: results[0].email,
                                        name: results[0].name
                                    }

                                    if(payload.email){
                                        
                                        let resetpass_token = jwt.sign({ id: payload.uuid, claim: payload}, config.secret, {expiresIn: 300}); 

                                        // mail settings
                                        let mailSettings = {
                                            from: '"Automailer" <' + mailer.mail.auth.user + '>',
                                            to: payload.email,
                                            subject: 'Password Reset Request for META',
                                            html: '<p>Hi ' + payload.name + ', <br><br> Your META password can be reset by clicking the link below. <br>If you did not request a new password, please ignore this email. <br><br><a href="http://'+ approver.admin.ip  +'/reset?token=' + resetpass_token + '" target="_blank">Reset Password</a>. <br><br> Thanks! </p>'
                                        }

                                        transporter.sendMail(mailSettings, function(error, info){
                                            if(error){ return res.send({err: '<center>Oops, there is a problem folding the email.<br> Please try it again. </center>'})};
                                            res.send({auth: '<center>Request has been sent. <br> Please check your email address.</center>'});
                                        });

                                    } else {
                                        res.send({auth:'<center>Request has been sent. <br> Please check your email address.</center>'});
                                    }

                                } else {

                                    res.send({auth: '<center>Request has been sent. <br> Please check your email address.</center>'});

                                }
                            });

                            connection.release();
                        });


                    }, function(err){
                        if(err){return res.send({err: err + ' token.'})};
                    });

                }

            }

        });
        

    });

    /** POST API for RESET-UPDATE password */
    app.post('/api/resetpassword', function(req, res){
        
        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields){
            if(err){ return res.send({err: 'Invalid form details. Please try again.'})};

            if(fields.authenticity_token && fields.newpassword && fields.reenterpassword){

                if(fields.newpassword == fields.reenterpassword){

                    function resetLinkToken(){
                        return new Promise(function(resolve, reject){
        
                            jwt.verify(fields.authenticity_token, config.secret, function(err, decoded){
                                if(err) {return res.status(200).render('resettoken_expired')};
                
                                let resetClaim = decoded.claim;
                                
                                resolve(resetClaim);
                            });
        
                        });
                        
                    }

                    resetLinkToken().then(function(resetClaim){

                        let newHashBrown = bcrypt.hashSync(fields.newpassword);

                        mysql.pool.getConnection(function(err, connection){
                            if(err){return res.send({err: 'Database error'})};

                            connection.query({
                                sql: 'UPDATE deepmes_auth_login SET password=? WHERE id=?',
                                values: [newHashBrown, resetClaim.id]
                            },  function(err, results){
                                if(err){return res.send({err: 'Unable to update password.'})};
                                if(results){

                                    let token = jwt.sign({ id: resetClaim.id, claim: resetClaim }, config.secret, {expiresIn: 60}); // 1 min
                                    res.cookie('basicToken_cookie', token);

                                    res.status(200).send({auth: 'Redirecting...', basicToken_cookie: true, token: token});

                                    // send email notification.
                                    let mailSettings = {
                                        from: '"Automailer" <' + mailer.mail.auth.user + '>',
                                        to: resetClaim.email,
                                        subject: 'Password Change Notification',
                                        html: '<p>Hello ' + resetClaim.name + ', <br><br> Password has been successfully changed. <br>You may now use your new password. To continue to META, Here\'s the link: http://'+ approver.admin.ip +' <br><br> Thanks </p>'
                                    }

                                    transporter.sendMail(mailSettings, function(error, info){
                                        if(error){ return res.send({err: '<center>Oops, there is a problem folding the email.<br> Please try it again. </center>'})};
                                    });

                                }
                            });
                            

                        });

                    });


                } else {
                    res.send({err: 'Password mismatched.'});
                }

            } else {
                res.send({err: 'Invalid form details. Please try again.'});
            }


        });

    });

    

}