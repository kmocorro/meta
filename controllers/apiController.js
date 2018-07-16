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

    /**redirect */

    app.get('/kitting', function(req, res){
        res.redirect('/coa/kitting');
    });

    app.get('/coauploader', function(req, res){
        res.redirect('/coa/qa');
    })

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
                            sql: 'SELECT * FROM tbl_coa_box ORDER BY id DESC LIMIT 10'
                        },  function(err, results){
                            if(err){return reject()};

                            if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){

                                let recent_activity_obj = [];
                                let kitting_settings_obj = [];
                                
                                for(let i=0;i<results.slice(-8).length;i++){
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
                                /**
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
                                } */

                                let data = {
                                    recent : recent_activity_obj,
                                    //settings: kitting_settings_obj
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

                            
                            //  expected worksheets name per supplier
                            let workbook_checker = {
                                acc_sheet1: 'COA',
                                acc_sheet2: 'Pallet_ID Carton_ID LOT_ID',
                                ferrotec_sheet1: 'COA',
                                ferrotec_sheet2: 'Ingot Lot Barcodes',
                                tzs_sheet1: 'PROPOSED CofA',
                                tzs_sheet2: 'Ingot Lot Barcodes',
                            }
    
    
                            if(worksheet.sheet1 == workbook_checker.acc_sheet1 && worksheet.sheet2 == workbook_checker.acc_sheet2){   // is workbook ACC ?
                                
                                let supplier_acc ={
                                    id: '1007',
                                    name: 'ACC',
                                }
                                
                                resolve(supplier_acc);
    
                            } else if (worksheet.sheet1 == workbook_checker.ferrotec_sheet1 && worksheet.sheet2 == workbook_checker.ferrotec_sheet2){ // is workbook Ferrotec?
    
                                let supplier_ferrotec ={
                                    id: '1003',
                                    name: 'FERROTEC',
                                }

                                resolve(supplier_ferrotec);
    
                            } else if (worksheet.sheet1 == workbook_checker.tzs_sheet1 && worksheet.sheet2 == workbook_checker.tzs_sheet2){ // is workbook tzs?
                                
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

                                    if(supplier_name.id == credentials.supplier_id && supplier_name.id == '1007' ){ // is ACC?

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

                                        function coaInsertACC(){
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

                                        function ingotInsertACC(){
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

                                        return coaInsertACC().then(function(){
                                            return ingotInsertACC().then(function(){

                                                res.send({auth:'Uploading... <br> Be patient. Large files need more time to build.'});

                                            },  function(err){
                                                res.send({err: 'Error while uploading sheet2 to database.'});
                                            });

                                        },  function(err){
                                            res.send({err: 'Error while uploading sheet1 to database.'});
                                        });


                                    } else if (supplier_name.id == credentials.supplier_id && supplier_name.id == '1003') { // is FERROTEC?
                                        
                                        let sheet1_workbookJSON = XLSX.utils.sheet_to_json(workbook.Sheets['COA'],{header: 'A'});
                                        let sheet2_workbookJSON = XLSX.utils.sheet_to_json(workbook.Sheets['Ingot Lot Barcodes'],{header: 1 });

                                        let cleaned_ferrotec_sheet1 = [];
                                        let cleaned_ferrotec_sheet2 = [];

                                        if(!sheet1_workbookJSON[1].BC){ // valid

                                            // clean sheet 1 obj
                                            for(let i=4;i<sheet1_workbookJSON.length;i++){ //STARTS in 4th array
                                                if(sheet1_workbookJSON[i].A != '' && sheet1_workbookJSON[i].B != null){

                                                    cleaned_ferrotec_sheet1.push({
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
                                                        BB: sheet1_workbookJSON[i].BB || null
                                                    });

                                                }

                                            }

                                            // clean sheet 2 obj
                                            for(let i=1;i<sheet2_workbookJSON.length;i++){
                                                if(sheet2_workbookJSON[i][0] !== null){

                                                    for(let j=1;j<sheet2_workbookJSON[i].length;j++){
                                                        cleaned_ferrotec_sheet2.push({
                                                            A: sheet2_workbookJSON[i][0] || null,
                                                            B: sheet2_workbookJSON[i][j] || null
                                                        });
                                                    }

                                                }
                                            }

                                            function coaInsertFERROTEC(){
                                                return new Promise(function(resolve, reject){

                                                    for(let i=0;i<cleaned_ferrotec_sheet1.length;i++){
                                                        mysql.pool.getConnection(function(err, connection){
                                                            if(err){return reject()}

                                                            connection.query({
                                                                sql: 'INSERT INTO tbl_ferrotec_coa SET supplier_id=?, delivery_date=?, order_no=?, upload_time=?, username=?, ingot_lot_id=?, box_id=?, wafer_qty=?, wafer_qty_difference=?, block_length=?, totalCrystal=?, seedBlock=?, MCLT_top=?, MCLT_tail=?, Res_top=?, Res_tail=?, Oi_top=?, Oi_tail=?, Cs_top=?, Cs_tail=?, Dia_ave=?, Dia_std=?, Dia_min=?, Dia_max=?, Flat_ave=?, Flat_std=?, Flat_min=?, Flat_max=?, Flat_taper_ave=?, Flat_taper_std=?, Flat_taper_min=?, Flat_taper_max=?, Corner_ave=?, Corner_std=?, Corner_min=?, Corner_max=?, Thickness_ave=?, Thickness_std=?, Thickness_min=?, Thickness_max=?, TTV_ave=?, TTV_std=?, TTV_min=?, TTV_max=?, RA_ave=?, RA_std=?, RA_min=?, RA_max=?, RZ_ave=?, RZ_std=?, RZ_min=?, RZ_max=?, Vertical_ave=?, Vertical_std=?, Vertical_min=?, Vertical_max=?, Copper_content=?, Iron_content=?, AcceptReject=?',
                                                                values: [credentials.supplier_id, credentials.delivery_date, credentials.order_no, new Date(), verified_username, cleaned_ferrotec_sheet1[i].A, cleaned_ferrotec_sheet1[i].B, cleaned_ferrotec_sheet1[i].C, cleaned_ferrotec_sheet1[i].D, cleaned_ferrotec_sheet1[i].E, cleaned_ferrotec_sheet1[i].F, cleaned_ferrotec_sheet1[i].G, cleaned_ferrotec_sheet1[i].H, cleaned_ferrotec_sheet1[i].I, cleaned_ferrotec_sheet1[i].J, cleaned_ferrotec_sheet1[i].K, cleaned_ferrotec_sheet1[i].L, cleaned_ferrotec_sheet1[i].M, cleaned_ferrotec_sheet1[i].N, cleaned_ferrotec_sheet1[i].O, cleaned_ferrotec_sheet1[i].P, cleaned_ferrotec_sheet1[i].Q, cleaned_ferrotec_sheet1[i].R, cleaned_ferrotec_sheet1[i].S, cleaned_ferrotec_sheet1[i].T, cleaned_ferrotec_sheet1[i].U, cleaned_ferrotec_sheet1[i].V, cleaned_ferrotec_sheet1[i].W, cleaned_ferrotec_sheet1[i].X, cleaned_ferrotec_sheet1[i].Y, cleaned_ferrotec_sheet1[i].Z, cleaned_ferrotec_sheet1[i].AA, cleaned_ferrotec_sheet1[i].AB, cleaned_ferrotec_sheet1[i].AC, cleaned_ferrotec_sheet1[i].AD, cleaned_ferrotec_sheet1[i].AE, cleaned_ferrotec_sheet1[i].AF, cleaned_ferrotec_sheet1[i].AG, cleaned_ferrotec_sheet1[i].AH, cleaned_ferrotec_sheet1[i].AI, cleaned_ferrotec_sheet1[i].AJ, cleaned_ferrotec_sheet1[i].AK, cleaned_ferrotec_sheet1[i].AL, cleaned_ferrotec_sheet1[i].AM, cleaned_ferrotec_sheet1[i].AN, cleaned_ferrotec_sheet1[i].AO, cleaned_ferrotec_sheet1[i].AP, cleaned_ferrotec_sheet1[i].AQ, cleaned_ferrotec_sheet1[i].AR, cleaned_ferrotec_sheet1[i].AS, cleaned_ferrotec_sheet1[i].AT, cleaned_ferrotec_sheet1[i].AU, cleaned_ferrotec_sheet1[i].AV, cleaned_ferrotec_sheet1[i].AW, cleaned_ferrotec_sheet1[i].AX, cleaned_ferrotec_sheet1[i].AY, cleaned_ferrotec_sheet1[i].AZ, cleaned_ferrotec_sheet1[i].BA, cleaned_ferrotec_sheet1[i].BB ]
                                                            },  function(err, results){
                                                                if(err){return reject()};

                                                                resolve();
                                                            });

                                                            connection.release();

                                                        });
                                                    }

                                                });
                                            }

                                            function ingotInsertFERROTEC(){
                                                return new Promise(function(resolve, reject){

                                                    for(let i=0;i<cleaned_ferrotec_sheet2.length;i++){
                                                        mysql.pool.getConnection(function(err, connection){
                                                            if(err){return reject()};

                                                            connection.query({
                                                                sql: 'INSERT INTO tbl_ferrotec_ingot SET supplier_id=?, delivery_date=?, order_no=?, upload_time=?, username=?,ingot_lot_id=?, bundle_barcode=?',
                                                                values: [credentials.supplier_id, credentials.delivery_date, credentials.order_no, new Date(), verified_username, cleaned_ferrotec_sheet2[i].A, cleaned_ferrotec_sheet2[i].B]
                                                            },  function(err, results){
                                                                if(err){return reject()};

                                                                resolve();
                                                            });

                                                            connection.release();


                                                        });


                                                    }

                                                });
                                            }

                                            return coaInsertFERROTEC().then(function(){
                                                return ingotInsertFERROTEC().then(function(){

                                                    res.send({auth:'Uploading... <br> Be patient. Large files need more time to build.'});

                                                });

                                            },  function(err){
                                                res.send({err: err});
                                            });


                                        } else {
                                            res.send({err: 'Invalid format.'});
                                        }

                                    } else if (supplier_name.id == credentials.supplier_id && supplier_name.id == '1001') {

                                        let sheet1_workbookJSON = XLSX.utils.sheet_to_json(workbook.Sheets['PROPOSED CofA'],{header: 'A'});
                                        let sheet2_workbookJSON = XLSX.utils.sheet_to_json(workbook.Sheets['Ingot Lot Barcodes'],{header: 1 });

                                        let cleaned_tzs_sheet1 = [];
                                        let cleaned_tzs_sheet2 = [];

                                        if(!sheet1_workbookJSON[3].BV){ // valid IF property .BV exists, invalid.

                                            // clean sheet 1 obj for tzs
                                            for(let i=3;i<sheet1_workbookJSON.length;i++){ //STARTS in 3rd array
                                                if(sheet1_workbookJSON[i].A && sheet1_workbookJSON[i].B){

                                                    cleaned_tzs_sheet1.push({
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
                                                        BB: sheet1_workbookJSON[i].BB || null
                                                    });

                                                } else if(!sheet1_workbookJSON[i].A){ // FOR MISSING A column

                                                    cleaned_tzs_sheet1.push({
                                                        A: sheet1_workbookJSON[i-1].A || sheet1_workbookJSON[i-2].A || sheet1_workbookJSON[i-3].A,
                                                        B: sheet1_workbookJSON[i].B || null,
                                                        C: sheet1_workbookJSON[i].C || null,
                                                        D: sheet1_workbookJSON[i].D || null,
                                                        E: sheet1_workbookJSON[i-1].E || sheet1_workbookJSON[i-2].E || sheet1_workbookJSON[i-3].E,
                                                        F: sheet1_workbookJSON[i-1].F || sheet1_workbookJSON[i-2].F || sheet1_workbookJSON[i-3].F,
                                                        G: sheet1_workbookJSON[i-1].G || sheet1_workbookJSON[i-2].G || sheet1_workbookJSON[i-3].G,
                                                        H: sheet1_workbookJSON[i-1].H || sheet1_workbookJSON[i-2].H || sheet1_workbookJSON[i-3].H,
                                                        I: sheet1_workbookJSON[i-1].I || sheet1_workbookJSON[i-2].I || sheet1_workbookJSON[i-3].I,
                                                        J: sheet1_workbookJSON[i-1].J || sheet1_workbookJSON[i-2].J || sheet1_workbookJSON[i-3].J,
                                                        K: sheet1_workbookJSON[i-1].K || sheet1_workbookJSON[i-2].K || sheet1_workbookJSON[i-3].K,
                                                        L: sheet1_workbookJSON[i-1].L || sheet1_workbookJSON[i-2].L || sheet1_workbookJSON[i-3].L,
                                                        M: sheet1_workbookJSON[i-1].M || sheet1_workbookJSON[i-2].M || sheet1_workbookJSON[i-3].M,
                                                        N: sheet1_workbookJSON[i-1].N || sheet1_workbookJSON[i-2].N || sheet1_workbookJSON[i-3].N,
                                                        O: sheet1_workbookJSON[i-1].O || sheet1_workbookJSON[i-2].O || sheet1_workbookJSON[i-3].O,
                                                        P: sheet1_workbookJSON[i-1].P || sheet1_workbookJSON[i-2].P || sheet1_workbookJSON[i-3].P,
                                                        Q: sheet1_workbookJSON[i-1].Q || sheet1_workbookJSON[i-2].Q || sheet1_workbookJSON[i-3].Q,
                                                        R: sheet1_workbookJSON[i-1].R || sheet1_workbookJSON[i-2].R || sheet1_workbookJSON[i-3].R,
                                                        S: sheet1_workbookJSON[i-1].S || sheet1_workbookJSON[i-2].S || sheet1_workbookJSON[i-3].S,
                                                        T: sheet1_workbookJSON[i-1].T || sheet1_workbookJSON[i-2].T || sheet1_workbookJSON[i-3].T,
                                                        U: sheet1_workbookJSON[i-1].U || sheet1_workbookJSON[i-2].U || sheet1_workbookJSON[i-3].U,
                                                        V: sheet1_workbookJSON[i-1].V || sheet1_workbookJSON[i-2].V || sheet1_workbookJSON[i-3].V,
                                                        W: sheet1_workbookJSON[i-1].W || sheet1_workbookJSON[i-2].W || sheet1_workbookJSON[i-3].W,
                                                        X: sheet1_workbookJSON[i-1].X || sheet1_workbookJSON[i-2].X || sheet1_workbookJSON[i-3].X,
                                                        Y: sheet1_workbookJSON[i-1].Y || sheet1_workbookJSON[i-2].Y || sheet1_workbookJSON[i-3].Y,
                                                        Z: sheet1_workbookJSON[i-1].Z || sheet1_workbookJSON[i-2].Z || sheet1_workbookJSON[i-3].Z,
                                                        AA: sheet1_workbookJSON[i-1].AA || sheet1_workbookJSON[i-2].AA || sheet1_workbookJSON[i-3].AA,
                                                        AB: sheet1_workbookJSON[i-1].AB || sheet1_workbookJSON[i-2].AB || sheet1_workbookJSON[i-3].AB,
                                                        AC: sheet1_workbookJSON[i-1].AC || sheet1_workbookJSON[i-2].AC || sheet1_workbookJSON[i-3].AC,
                                                        AD: sheet1_workbookJSON[i-1].AD || sheet1_workbookJSON[i-2].AD || sheet1_workbookJSON[i-3].AD,
                                                        AE: sheet1_workbookJSON[i-1].AE || sheet1_workbookJSON[i-2].AE || sheet1_workbookJSON[i-3].AE,
                                                        AF: sheet1_workbookJSON[i-1].AF || sheet1_workbookJSON[i-2].AF || sheet1_workbookJSON[i-3].AF,
                                                        AG: sheet1_workbookJSON[i-1].AG || sheet1_workbookJSON[i-2].AG || sheet1_workbookJSON[i-3].AG,
                                                        AH: sheet1_workbookJSON[i-1].AH || sheet1_workbookJSON[i-2].AH || sheet1_workbookJSON[i-3].AH,
                                                        AI: sheet1_workbookJSON[i-1].AI || sheet1_workbookJSON[i-2].AI || sheet1_workbookJSON[i-3].AI,
                                                        AJ: sheet1_workbookJSON[i-1].AJ || sheet1_workbookJSON[i-2].AJ || sheet1_workbookJSON[i-3].AJ,
                                                        AK: sheet1_workbookJSON[i-1].AK || sheet1_workbookJSON[i-2].AK || sheet1_workbookJSON[i-3].AK,
                                                        AL: sheet1_workbookJSON[i-1].AL || sheet1_workbookJSON[i-2].AL || sheet1_workbookJSON[i-3].AL,
                                                        AM: sheet1_workbookJSON[i-1].AM || sheet1_workbookJSON[i-2].AM || sheet1_workbookJSON[i-3].AM,
                                                        AN: sheet1_workbookJSON[i-1].AN || sheet1_workbookJSON[i-2].AN || sheet1_workbookJSON[i-3].AN,
                                                        AO: sheet1_workbookJSON[i-1].AO || sheet1_workbookJSON[i-2].AO || sheet1_workbookJSON[i-3].AO,
                                                        AP: sheet1_workbookJSON[i-1].AP || sheet1_workbookJSON[i-2].AP || sheet1_workbookJSON[i-3].AP,
                                                        AQ: sheet1_workbookJSON[i-1].AQ || sheet1_workbookJSON[i-2].AQ || sheet1_workbookJSON[i-3].AQ,
                                                        AR: sheet1_workbookJSON[i-1].AR || sheet1_workbookJSON[i-2].AR || sheet1_workbookJSON[i-3].AR,
                                                        AS: sheet1_workbookJSON[i-1].AS || sheet1_workbookJSON[i-2].AS || sheet1_workbookJSON[i-3].AS,
                                                        AT: sheet1_workbookJSON[i-1].AT || sheet1_workbookJSON[i-2].AT || sheet1_workbookJSON[i-3].AT,
                                                        AU: sheet1_workbookJSON[i-1].AU || sheet1_workbookJSON[i-2].AU || sheet1_workbookJSON[i-3].AU,
                                                        AV: sheet1_workbookJSON[i-1].AV || sheet1_workbookJSON[i-2].AV || sheet1_workbookJSON[i-3].AV,
                                                        AW: sheet1_workbookJSON[i-1].AW || sheet1_workbookJSON[i-2].AW || sheet1_workbookJSON[i-3].AW,
                                                        AX: sheet1_workbookJSON[i-1].AX || sheet1_workbookJSON[i-2].AX || sheet1_workbookJSON[i-3].AX,
                                                        AY: sheet1_workbookJSON[i-1].AY || sheet1_workbookJSON[i-2].AY || sheet1_workbookJSON[i-3].AY,
                                                        AZ: sheet1_workbookJSON[i-1].AZ || sheet1_workbookJSON[i-2].AZ || sheet1_workbookJSON[i-3].AZ,
                                                        BA: sheet1_workbookJSON[i-1].BA || sheet1_workbookJSON[i-2].BA || sheet1_workbookJSON[i-3].BA,
                                                        BB: sheet1_workbookJSON[i].BB || null
                                                    });
                                                }

                                            }

                                            // clean sheet 2 obj
                                            for(let i=1;i<sheet2_workbookJSON.length;i++){
                                                if(sheet2_workbookJSON[i][0] !== null){

                                                    for(let j=1;j<sheet2_workbookJSON[i].length;j++){
                                                        cleaned_tzs_sheet2.push({
                                                            A: sheet2_workbookJSON[i][0] || null,
                                                            B: sheet2_workbookJSON[i][j] || null
                                                        });
                                                    }

                                                }
                                            }

                                            function coaInsertTZS(){
                                                return new Promise(function(resolve, reject){
                                                    
                                                    for(let i=0;i<cleaned_tzs_sheet1.length;i++){
                                                        mysql.pool.getConnection(function(err, connection){
                                                            if(err){return reject()}

                                                            connection.query({ // pallet no not included in db.
                                                                sql: 'INSERT INTO tbl_tzs_coa SET supplier_id=?, delivery_date=?, order_no=?, upload_time=?, username=?, ingot_lot_id=?, box_id=?, location_id=?,wafer_pcs=?,block_length=?,totalCrystal_length=?,seedBlock=?,MCLT_top=?,MCLT_tail=?,RES_top=?,RES_tail=?,Oi_top=?,Oi_tail=?,Cs_top=?,Cs_tail=?,Dia_ave=?,Dia_std=?,Dia_min=?,Dia_max=?,Flat_ave=?,Flat_std=?,Flat_min=?,Flat_max=?,Flat_taper1=?,Flat_taper2=?,Flat_taper_min=?,Flat_taper_max=?,Corner_ave=?,Corner_std=?,Corner_min=?,Corner_max=?,Center_ave=?,Center_std=?,Center_min=?,Center_max=?,TTV_ave=?,TTV_std=?,TTV_min=?,TTV_max=?,RA_ave=?,RA_std=?,RA_min=?,RA_max=?,RZ_ave=?,RZ_std=?,RZ_min=?,RZ_max=?,Ver_ave=?,Ver_std=?,Ver_min=?,Ver_max=?,Copper_content=?,Iron_content=?,AcceptReject=?',
                                                                values: [credentials.supplier_id, credentials.delivery_date, credentials.order_no, new Date(), verified_username, cleaned_tzs_sheet1[i].A, cleaned_tzs_sheet1[i].B,  cleaned_tzs_sheet1[i].C, cleaned_tzs_sheet1[i].D, cleaned_tzs_sheet1[i].E, cleaned_tzs_sheet1[i].F, cleaned_tzs_sheet1[i].G, cleaned_tzs_sheet1[i].H, cleaned_tzs_sheet1[i].I, cleaned_tzs_sheet1[i].J, cleaned_tzs_sheet1[i].K, cleaned_tzs_sheet1[i].L, cleaned_tzs_sheet1[i].M, cleaned_tzs_sheet1[i].N, cleaned_tzs_sheet1[i].O, cleaned_tzs_sheet1[i].P, cleaned_tzs_sheet1[i].Q, cleaned_tzs_sheet1[i].R, cleaned_tzs_sheet1[i].S, cleaned_tzs_sheet1[i].T, cleaned_tzs_sheet1[i].U, cleaned_tzs_sheet1[i].V, cleaned_tzs_sheet1[i].W, cleaned_tzs_sheet1[i].X, cleaned_tzs_sheet1[i].Y, cleaned_tzs_sheet1[i].Z, cleaned_tzs_sheet1[i].AA, cleaned_tzs_sheet1[i].AB, cleaned_tzs_sheet1[i].AC, cleaned_tzs_sheet1[i].AD, cleaned_tzs_sheet1[i].AE, cleaned_tzs_sheet1[i].AF, cleaned_tzs_sheet1[i].AG, cleaned_tzs_sheet1[i].AH, cleaned_tzs_sheet1[i].AI, cleaned_tzs_sheet1[i].AJ, cleaned_tzs_sheet1[i].AK, cleaned_tzs_sheet1[i].AL, cleaned_tzs_sheet1[i].AM, cleaned_tzs_sheet1[i].AN, cleaned_tzs_sheet1[i].AO, cleaned_tzs_sheet1[i].AP, cleaned_tzs_sheet1[i].AQ, cleaned_tzs_sheet1[i].AR, cleaned_tzs_sheet1[i].AS, cleaned_tzs_sheet1[i].AT, cleaned_tzs_sheet1[i].AU, cleaned_tzs_sheet1[i].AV, cleaned_tzs_sheet1[i].AW, cleaned_tzs_sheet1[i].AX, cleaned_tzs_sheet1[i].AY, cleaned_tzs_sheet1[i].AZ, cleaned_tzs_sheet1[i].BA, cleaned_tzs_sheet1[i].BB ]
                                                            },  function(err, results){
                                                                if(err){return reject()};

                                                                resolve();
                                                            });

                                                            connection.release();

                                                        });
                                                    }

                                                });
                                            }

                                            function ingotInsertTZS(){
                                                return new Promise(function(resolve, reject){

                                                    for(let i=0;i<cleaned_tzs_sheet2.length;i++){
                                                        mysql.pool.getConnection(function(err, connection){
                                                            if(err){return reject()};

                                                            connection.query({
                                                                sql: 'INSERT INTO tbl_ingot_lot_barcodes SET supplier_id=?, delivery_date=?, order_no=?, upload_time=?, username=?,ingot_lot_id=?, bundle_barcode=?',
                                                                values: [credentials.supplier_id, credentials.delivery_date, credentials.order_no, new Date(), verified_username, cleaned_tzs_sheet2[i].A, cleaned_tzs_sheet2[i].B]
                                                            },  function(err, results){
                                                                if(err){return reject()};

                                                                resolve();
                                                            });

                                                            connection.release();


                                                        });


                                                    }


                                                });
                                            }

                                            return coaInsertTZS().then(function(){
                                                return ingotInsertTZS().then(function(){

                                                    res.send({auth:'Uploading... <br> Be patient. Large files need more time to build.'});

                                                },  function(err){
                                                    res.send({err: 'error at ingot insert tzs'});
                                                });
                                            },  function(err){
                                                res.send({err: 'error at coa insert tzs'});
                                            });

                                        } else {
                                            res.send({err: 'Invalid format.'});
                                        }

                                    } else {
                                        res.send({err: 'File does not matched to supplier.'});
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