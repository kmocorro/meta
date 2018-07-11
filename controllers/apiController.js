let bodyParser = require('body-parser');
let verifyToken = require('../auth/verifyToken');
let uuidv4 = require('uuid/v4');
let jwt = require('jsonwebtoken');
let config = require('../auth/config');
let formidable = require('formidable');
let XLSX = require('xlsx');
let mysql = require('../db/dbConfig');
let moment = require('moment');

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

            mysql.pool.getConnection(function(err, connection){
                if(err){return res.send({err: 'Cannot conenct to database'})};

                function coaQA(){
                    return new Promise(function(resolve, reject){

                        connection.query({
                            sql: 'SELECT B.supplier_name, A.order_no, A.username, A.upload_time, A.delivery_date FROM (SELECT id, supplier_id, upload_time, order_no, delivery_date, username FROM tbl_ingot_lot_barcodes GROUP BY order_no UNION SELECT id, supplier_id, upload_time, order_no, delivery_date, username FROM tbl_achl_ingot_v2 GROUP BY order_no UNION SELECT id, supplier_id, upload_time, order_no, delivery_date, username FROM tbl_ferrotec_ingot GROUP BY order_no) A JOIN (SELECT supplier_id, supplier_name FROM tbl_supplier_list) B ON A.supplier_id = B.supplier_id ORDER BY A.upload_time DESC'
                        },  function(err, results){
                            if(err){return reject()};

                            if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){

                                let recentActivity = [];
                                let uploadHistory = [];

                                for(let i=0; i<results.slice(-5).length;i++){
                                    recentActivity.push({
                                        supplier: results[i].supplier_name,
                                        date: moment(results[i].upload_time).format('llll'),
                                        delivery_date: moment(results[i].delivery_date).format('llll'),
                                        invoice: results[i].order_no,
                                        username: results[i].username
                                    });
                                }

                                for(let i=0; i<results.length;i++){
                                    uploadHistory.push({
                                        supplier: results[i].supplier_name,
                                        date: moment(results[i].upload_time).format('llll'),
                                        delivery_date: moment(results[i].delivery_date).format('llll'),
                                        invoice: results[i].order_no,
                                        username: results[i].username
                                    });
                                }

                                let data = {
                                    recent : recentActivity,
                                    settings: uploadHistory
                                }

                                resolve(data);
                                

                            } else {
                                reject();
                            }

                        });

                    });
                }

                coaQA().then(function(data){
                    
                    let todayDate = moment(new Date()).format('lll');

                    connection.release();
                    res.render('coa', {username: req.claim.username, department: req.claim.department, data, authenticity_token, todayDate});

                },  function(err){
                    res.send({err: 'Invalid query.'});
                });

            });

        } else {
            res.render('login');
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

            mysql.pool.getConnection(function(err, connection){
                if(err){return res.send({err: 'Cannot connect to database'})};

                function coaKitting(){
                    return new Promise(function(resolve, reject){

                        connection.query({
                            sql: 'SELECT * FROM tbl_coa_box ORDER BY id DESC LIMIT 50'
                        },  function(err, results){
                            if(err){return reject()};

                            if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){

                                let recent_activity_obj = [];
                                let kitting_settings_obj = [];
                                
                                for(let i=0;i<results.slice(-5).length;i++){
                                    if(results[i].box_id){

                                        recent_activity_obj.push({
                                            id: results[i].id,
                                            upload_date: moment(results[i].upload_date).calendar(),
                                            box_id: results[i].box_id,
                                            runcard: results[i].runcard,
                                            username: results[i].username
                                        });
                                    }
                                }

                                for(let i=0;i<results.length;i++){
                                    if(results[i].box_id){

                                        kitting_settings_obj.push({
                                            id: results[i].id,
                                            upload_date: moment(results[i].upload_date).format('lll'),
                                            box_id: results[i].box_id,
                                            runcard: results[i].runcard,
                                            username: results[i].username
                                        });
                                    }
                                }

                                let data = {
                                    recent : recent_activity_obj,
                                    settings: kitting_settings_obj
                                }

                                resolve(data);

                            } else {
                                reject();
                            }

                        });

                        connection.release();

                    });

                }

                coaKitting().then(function(data){
                    let todayDate = moment(new Date()).format('lll');

                    res.render('kitting', { username: req.claim.username, department: req.claim.department, authenticity_token,  data, todayDate});
                },  function(err){
                    res.send({err: err});
                });
                

            });

        } else {
            res.render('login');
        }
    })

    /** submit coa form + file */
    app.post('/api/coa', verifyToken, function(req, res){

        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields, file){
            if(err){ return res.send({err: 'Invalid form. Try again'})};

            if(fields && file){

                if(fields.invoice && fields.supplier && fields.datepicker){
                    
                    let momentDate = new Date(fields.datepicker);

                    let credentials = {
                        token: fields.authenticity_token,
                        order_no: fields.invoice,
                        supplier_id: fields.supplier,
                        delivery_date: momentDate
                    }
                    
                    let excelFile = {
                        date_upload: new Date(),
                        path: file.coafile.path,
                        name: file.coafile.name,
                        type: file.coafile.type,
                        date_modified: file.coafile.lastModifiedDate
                    }

                    //  expected worksheets name per supplier
                    let workbook_checker = {
                        acc_sheet1: 'COA',
                        acc_sheet2: 'Pallet_ID Carton_ID LOT_ID',
                        ferrotec_sheet1: 'COA',
                        ferrotec_sheet2: 'Ingot Lot Barcodes',
                        tzs_sheet1: 'PROPOSED CofA',
                        tzs_sheet2: 'Ingot Lot Barcodes',
                    }
    
                    let workbook = XLSX.readFile(excelFile.path);
    
                    //  verify token
                    function verifyLinkToken(){ // resolve()
                        return new Promise(function(resolve, reject){
    
                            jwt.verify(credentials.token, config.secret, function(err, decoded){
                                if(err){ return reject(err)};
    
                                resolve();
    
                            });
    
                        });
                    }
    
                    //  check workbook supplier
                    function checkSupplier(){ // resolve(SUPPLIERNAME)
                        return new Promise(function(resolve, reject){
                            
                            // worksheet name
                            let worksheet = {
                                sheet1: workbook.SheetNames[0],
                                sheet2: workbook.SheetNames[1]
                            }
    
    
                            if(worksheet.sheet2 == workbook_checker.acc_sheet2){   // is workbook ACC ?
                                
                                let supplier_acc ={
                                    id: '1007',
                                    name: 'ACC',
                                }
                                
                                resolve(supplier_acc);
    
                            } else if (worksheet.sheet1 == workbook_checker.ferrotec_sheet1){ // is workbook Ferrotec?
    
                                let supplier_ferrotec ={
                                    id: '1003',
                                    name: 'FERROTEC',
                                }

                                resolve(supplier_ferrotec);
    
                            } else if (worksheet.sheet1 == workbook_checker.tzs_sheet1){ // is workbook tzs?
                                
                                let supplier_tzs ={
                                    id: '1001',
                                    name: 'TZS',
                                }

                                resolve(supplier_tzs);
                            
                            } else { // Invalid
    
                                reject('Invalid CoA file.');
    
                            }
                            
                        });
                    }
    
                    function checkUser(){ // resolve(verified_username)
                        return new Promise(function(resolve, reject){
                            
                            mysql.pool.getConnection(function(err, connection){
                                if(err){return reject()};

                                connection.query({
                                    sql: 'SELECT * FROM deepmes_auth_login WHERE id=?',
                                    values: [req.userID]
                                },  function(err, results){
                                    if(err){return reject(err)};
    
                                    if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){
                                        let verified_username = results[0].username;
                                        resolve(verified_username);
                                    } else {
                                        reject();
                                    }
                                });

                                connection.release();
                            
                            });

                        });
                    }

                    
                    function isInvoiceExists(){ // resolve()
                        return new Promise(function(resolve, reject){
                            mysql.pool.getConnection(function(err, connection){
                                if(err){return reject()};

                                connection.query({
                                    sql: 'SELECT * FROM view_existing_invoice_v2 WHERE order_no=?',
                                    values: [credentials.order_no]
                                },  function(err, results){
                                    if(err){return reject()};

                                    if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){
                                        reject('Invoice already exists.');
                                    } else {
                                        resolve();
                                    }

                                });

                                connection.release();

                            });

                        });
                    }

                    verifyLinkToken().then(function(){
                        return checkSupplier().then(function(supplier_name){
                            return checkUser().then(function(verified_username){
                                return isInvoiceExists().then(function(){
                                    
                                    if(supplier_name.id == credentials.supplier_id){
                                        
                                        let sheet1_workbookJSON = XLSX.utils.sheet_to_json(workbook.Sheets['COA'],{header: 'A'});
                                        let sheet2_workbookJSON = XLSX.utils.sheet_to_json(workbook.Sheets['Pallet_ID Carton_ID LOT_ID'],{header: 'A'});

                                        let cleaned_acc_sheet1 = [];
                                        let cleaned_acc_sheet2 = [];

                                        // clean sheet1 obj
                                        for(let i=5;i<sheet1_workbookJSON.length;i++){ //STARTS in 5th array
                                            
                                            cleaned_acc_sheet1.push({
                                                A: sheet1_workbookJSON[i].A || null,
                                                B: sheet1_workbookJSON[i].B || null,
                                                C: sheet1_workbookJSON[i].C || null,
                                                D: sheet1_workbookJSON[i].D || null,
                                                E: sheet1_workbookJSON[i].E || null,
                                                F: sheet1_workbookJSON[i].F || null,
                                                G: sheet1_workbookJSON[i].G || null,
                                                H: sheet1_workbookJSON[i].H || null,
                                                I: sheet1_workbookJSON[i].I || null,
                                                J: sheet1_workbookJSON[i].J || null,
                                                K: sheet1_workbookJSON[i].K || null,
                                                L: sheet1_workbookJSON[i].L || null,
                                                M: sheet1_workbookJSON[i].M || null,
                                                N: sheet1_workbookJSON[i].N || null,
                                                O: sheet1_workbookJSON[i].O || null,
                                                P: sheet1_workbookJSON[i].P || null,
                                                Q: sheet1_workbookJSON[i].Q || null,
                                                R: sheet1_workbookJSON[i].R || null,
                                                S: sheet1_workbookJSON[i].S || null,
                                                T: sheet1_workbookJSON[i].T || null,
                                                U: sheet1_workbookJSON[i].U || null,
                                                V: sheet1_workbookJSON[i].V || null,
                                                W: sheet1_workbookJSON[i].W || null,
                                                X: sheet1_workbookJSON[i].X || null,
                                                Y: sheet1_workbookJSON[i].Y || null,
                                                Z: sheet1_workbookJSON[i].Z || null,
                                                AA: sheet1_workbookJSON[i].AA || null,
                                                AB: sheet1_workbookJSON[i].AB || null,
                                                AC: sheet1_workbookJSON[i].AC || null,
                                                AD: sheet1_workbookJSON[i].AD || null,
                                                AE: sheet1_workbookJSON[i].AE || null,
                                                AF: sheet1_workbookJSON[i].AF || null,
                                                AG: sheet1_workbookJSON[i].AG || null,
                                                AH: sheet1_workbookJSON[i].AH || null,
                                                AI: sheet1_workbookJSON[i].AI || null,
                                                AJ: sheet1_workbookJSON[i].AJ || null,
                                                AK: sheet1_workbookJSON[i].AK || null,
                                                AL: sheet1_workbookJSON[i].AL || null,
                                                AM: sheet1_workbookJSON[i].AM || null,
                                                AN: sheet1_workbookJSON[i].AN || null,
                                                AO: sheet1_workbookJSON[i].AO || null,
                                                AP: sheet1_workbookJSON[i].AP || null,
                                                AQ: sheet1_workbookJSON[i].AQ || null,
                                                AR: sheet1_workbookJSON[i].AR || null,
                                                AS: sheet1_workbookJSON[i].AS || null,
                                                AT: sheet1_workbookJSON[i].AT || null,
                                                AU: sheet1_workbookJSON[i].AU || null,
                                                AV: sheet1_workbookJSON[i].AV || null,
                                                AW: sheet1_workbookJSON[i].AW || null,
                                                AX: sheet1_workbookJSON[i].AX || null,
                                                AY: sheet1_workbookJSON[i].AY || null,
                                                AZ: sheet1_workbookJSON[i].AZ || null,
                                                BA: sheet1_workbookJSON[i].BA || null,
                                                BB: sheet1_workbookJSON[i].BB || null,
                                            });

                                        }
                                        
                                        // clean sheet2 obj
                                        for(let i=1;i<sheet2_workbookJSON.length;i++){
                                            cleaned_acc_sheet2.push({
                                                A: sheet2_workbookJSON[i].A || null,
                                                B: sheet2_workbookJSON[i].B || null,
                                                C: sheet2_workbookJSON[i].C || null,
                                                D: sheet2_workbookJSON[i].D || null,
                                                E: sheet2_workbookJSON[i].E || null
                                            });
                                        }

                                        function coaInsert(){
                                            return new Promise(function(resolve, reject){

                                                // insert sheet1 to tbl_achl_coa_v2
                                                for(let i=0;i<cleaned_acc_sheet1.length;i++){
                                                    mysql.pool.getConnection(function(err, connection){
                                                        if(err){return reject()}

                                                        connection.query({
                                                            sql: 'INSERT INTO tbl_achl_coa_v2 SET supplier_id=?, delivery_date=?, order_no=?, upload_time=?, username=?, ingot_lot_id=?, box_id=?, location=?, wafer_qty=?, blocklength=?, totalcrystal=?, seedblock=?, mclt_top=?, mclt_bottom=?, res_top=?, res_bottom=?, oi_top=?, oi_bottom=?, cs_top=?, cs_bottom=?, dia_ave=?, dia_std=?, dia_min=?, dia_max=?, flat_width_ave=?, flat_width_std=?, flat_width_min=?, flat_width_max=?, flat_length_ave=?, flat_length_std=?, flat_length_min=?, flat_length_max=?, corner_length_ave=?, corner_length_std=?, corner_length_min=?, corner_length_max=?, center_thickness_ave=?, center_thickness_std=?, center_thickness_min=?, center_thickness_max=?, ttv_ave=?, ttv_std=?, ttv_min=?, ttv_max=?, ra_ave=?, ra_std=?, ra_min=?, ra_max=?, rz_ave=?, rz_std=?, rz_min=?, rz_max=?, verticality_ave=?, verticality_std=?, verticality_min=?, verticality_max=?, copper_content=?, iron_content=?, acceptreject=?',
                                                            values: [credentials.supplier_id, credentials.delivery_date, credentials.order_no, new Date(), verified_username, cleaned_acc_sheet1[i].A, cleaned_acc_sheet1[i].B, cleaned_acc_sheet1[i].C, cleaned_acc_sheet1[i].D, cleaned_acc_sheet1[i].E, cleaned_acc_sheet1[i].F, cleaned_acc_sheet1[i].G, cleaned_acc_sheet1[i].H, cleaned_acc_sheet1[i].I, cleaned_acc_sheet1[i].J, cleaned_acc_sheet1[i].K, cleaned_acc_sheet1[i].L, cleaned_acc_sheet1[i].M, cleaned_acc_sheet1[i].N, cleaned_acc_sheet1[i].O, cleaned_acc_sheet1[i].P, cleaned_acc_sheet1[i].Q, cleaned_acc_sheet1[i].R, cleaned_acc_sheet1[i].S, cleaned_acc_sheet1[i].T, cleaned_acc_sheet1[i].U, cleaned_acc_sheet1[i].V, cleaned_acc_sheet1[i].W, cleaned_acc_sheet1[i].X, cleaned_acc_sheet1[i].Y, cleaned_acc_sheet1[i].Z, cleaned_acc_sheet1[i].AA, cleaned_acc_sheet1[i].AB, cleaned_acc_sheet1[i].AC, cleaned_acc_sheet1[i].AD, cleaned_acc_sheet1[i].AE, cleaned_acc_sheet1[i].AF, cleaned_acc_sheet1[i].AG, cleaned_acc_sheet1[i].AH, cleaned_acc_sheet1[i].AI, cleaned_acc_sheet1[i].AJ, cleaned_acc_sheet1[i].AK, cleaned_acc_sheet1[i].AL, cleaned_acc_sheet1[i].AM, cleaned_acc_sheet1[i].AN, cleaned_acc_sheet1[i].AO, cleaned_acc_sheet1[i].AP, cleaned_acc_sheet1[i].AQ, cleaned_acc_sheet1[i].AR, cleaned_acc_sheet1[i].AS, cleaned_acc_sheet1[i].AT, cleaned_acc_sheet1[i].AU, cleaned_acc_sheet1[i].AV, cleaned_acc_sheet1[i].AW, cleaned_acc_sheet1[i].AX, cleaned_acc_sheet1[i].AY, cleaned_acc_sheet1[i].AZ, cleaned_acc_sheet1[i].BA, cleaned_acc_sheet1[i].BB ]
                                                        },  function(err, results){
                                                            if(err){return reject()};

                                                            resolve();
                                                        });

                                                        connection.release();

                                                    });

                                                }                            

                                            });
                                        }

                                        function ingotInsert(){
                                            return new Promise(function(resolve, reject){

                                                // insert sheet2 to tbl_achl_ingot_v2
                                                for(let i=0;i<cleaned_acc_sheet2.length;i++){

                                                    mysql.pool.getConnection(function(err, connection){
                                                        if(err){return reject()};

                                                        connection.query({
                                                            sql: 'INSERT INTO tbl_achl_ingot_v2 SET supplier_id=?, delivery_date=?, order_no=?, upload_time=?, username=?, pallet_id=?, carton_id=?, lot_id=?, box_id=?, qty=?',
                                                            values: [credentials.supplier_id, credentials.delivery_date, credentials.order_no, new Date(), verified_username, cleaned_acc_sheet2[i].A, cleaned_acc_sheet2[i].B, cleaned_acc_sheet2[i].C, cleaned_acc_sheet2[i].D, cleaned_acc_sheet2[i].E]
                                                        },  function(err, results){
                                                            if(err){return reject()};

                                                            resolve();
                                                        });

                                                        connection.release();
                                                    });

                                                }

                                            });
                                        }

                                        return coaInsert().then(function(){
                                            return ingotInsert().then(function(){

                                                res.send({auth:'Uploading... <br> Be patient. Large files need more time to build.'});

                                            },  function(err){
                                                res.send({err: 'Error while uploading sheet2 to database.'});
                                            });

                                        },  function(err){
                                            res.send({err: 'Error while uploading sheet1 to database.'});
                                        });


                                    } else if (supplier_name.id == credentials.supplier_id) {
                                        res.send({auth: 'FERROTEC'});
                                    } else if (supplier_name.id == credentials.supplier_id) {
                                        res.send({auth: 'TZS'});
                                    } else {
                                        res.send({err: 'File does not matched with supplier.'});
                                    }


                                },  function(err){
                                    res.send({err: err});
                                });

                            },  function(err){
                                res.send({err: err});
                            });

                        },  function(err){
                            res.send({err: err});
                        });

                    },  function(err){
                        res.send({err: 'Invalid token. Refresh page.'});
                    });
    

                } else {
                    res.send({err: 'Invalid form.'});
                }

            } else {
                res.send({err: 'Invalid form.'});
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
    });

    /** delete coa boxid and runcard details */
    app.post('/api/kittingdelete', verifyToken, function(req, res){
        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields){
            if(err){ return res.send({err: 'Invalid action. Try again'})};

            if(req.userID && req.claim){

                if(fields){

                    let data_editor = req.claim.username;
                    let data_owner = fields.deleteByUsername;
                    let data_token = fields.authenticity_token;
                    let data_id = fields.deleteById;

                    if(data_editor == data_owner){ // valid requestor of form?

                        //  verify token
                        function verifyLinkToken(){
                            return new Promise(function(resolve, reject){

                                jwt.verify(data_token, config.secret, function(err, decoded){
                                    if(err){ return reject(err)};

                                    resolve();

                                });

                            });
                        }

                        mysql.pool.getConnection(function(err, connection){
                            if(err){return res.send({err: 'Cannot connect to database.'})};

                            function deleteData(){
                                return new Promise(function(resolve, reject){

                                    connection.query({
                                        sql: 'DELETE FROM tbl_coa_box WHERE id=?',
                                        values: [data_id]
                                    },  function(err, results){
                                        if(err){return reject()};
                                        resolve();
                                    });

                                });
                            }

                            verifyLinkToken().then(function(){
                                return deleteData().then(function(){

                                    connection.release();
                                    res.send({auth: 'Deleted successfully.'});


                                },  function(err){
                                    res.send({err:'Error delete query.'});
                                });

                            },  function(err){
                                res.send({err:'Invalid token. Please refresh page.'});
                            });
                        
                        });

                    } else {
                        
                        res.send({err: 'Unauthorized. <br> Only <i>' + data_owner + '</i> can delete transaction id ' + data_id +'.'});

                    }


                }

            }

        });

    });

    /** edit coa boxid and runcard details */
    app.post('/api/kittingedit', verifyToken, function(req, res){
        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields){
            if(err){ return res.send({err: 'Invalid action. Try again'})};

            if(req.userID && req.claim){

                if(fields){

                    let data_editor = req.claim.username;
                    let data_owner = fields.edit_username;

                    let data_update = {
                        authenticity_token: fields.authenticity_token,
                        id: fields.edit_id,
                        box_id: fields.edit_boxid,
                        runcard: fields.edit_runcard
                    }

                    if(data_editor == data_owner){ // valid requestor of form?

                        //  verify token
                        function verifyLinkToken(){
                            return new Promise(function(resolve, reject){

                                jwt.verify(data_update.authenticity_token, config.secret, function(err, decoded){
                                    if(err){ return reject(err)};

                                    resolve();

                                });

                            });
                        }

                        mysql.pool.getConnection(function(err, connection){
                            if(err){ return res.send({err: 'Cannot connect to database'})};

                            function editData(){
                                return new Promise(function(resolve, reject){
                                    
                                    connection.query({
                                        sql: 'UPDATE tbl_coa_box SET box_id=?, runcard=? WHERE id=?',
                                        values: [data_update.box_id, data_update.runcard, data_update.id]
                                    },  function(err, results){
                                        if(err){return reject()};
                                        resolve();
                                    });
                                
                                });
                            }


                            verifyLinkToken().then(function(){
                                return editData().then(function(){
                                    
                                    connection.release();
                                    res.send({auth: 'Updated successfully.'});

                                },  function(err){
                                    res.send({err: 'Error update to database.'});
                                });
                                
                            },  function(err){
                                res.send({err: 'Invalid token. Please refresh page.'});
                            });

                        });

                    } else {
                        
                        res.send({err: 'Unauthorized. <br> Only <i>' + data_owner + '</i> can edit transaction id ' + data_update.id +'.'});

                    }

                }

            }

        });

    });

}