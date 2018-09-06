let Client = require('ssh2').Client;
let sshConfig = require('../config').sshConfig;
let mysql = require('../db/dbConfig');

module.exports = function(io){

    io.on('connection', function(socket){
        
        socket.on('inline-thread', function(inline_msg){ // inline_msg: { inline_name : , status : , durations : }

            let sshFilePathExecute = 'NOXE/NOXE_Relayer.sh ' + inline_msg.inline_name + ' ' + inline_msg.status + ' ' + inline_msg.duration;

            let conn = new Client(); // build ssh client connection

            mysql.pool.getConnection(function(err, connection){
                if(err){return socket.emit('inline-thread-alert', {alert: 'Error on database connection.'})}
                
                connection.query({ // verify
                    sql: 'SELECT * FROM tbl_inline_quick_change WHERE inline_name = ? ORDER BY id DESC LIMIT 1',
                    values: [inline_msg.inline_name]
                },  function(err, results){
                    if(err){return socket.emit('inline-thread-alert', {alert: 'Error query on current status.'})};

                    if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){

                        if(results[0].status_name == 'Status Changed'){

                            // return and disable button

                            socket.emit('inline-thread-response', {
                                message: { 
                                    inline_name : inline_msg.inline_name,
                                    status_name: 'Status Changed'
                                }
                            });
                            connection.release();

                        } else if (results[0].status_name == 'Status Reverted'){

                            conn.on('ready', function(){ // connect to ssh
                                console.log('SSH client :: open for ' + inline_msg.inline_name );

                                // connect via ssh
                                conn.shell(function(err, stream) {
                                    if (err) throw err; // for the meantime.
                    
                                    stream.on('data', function(data) {
                                        //console.log('STDOUT: ' + data);
                                    });
                                    stream.stderr.on('data', function(data) {
                                        console.log('STDERR: ' + data);
                    
                                    });
                                    stream.on('close', function() {
                                        console.log('SSH client :: closed for ' + inline_msg.inline_name);
                                    });
                    
                                });
                    
                                // execute bash file under ssh client
                                conn.exec(sshFilePathExecute, function(err, stream){
                                    if(err) throw err; // for the meantime.
                    
                                    stream.on('data', function(data){

                                        let inline_details = {
                                            cli: data,
                                            buffer_to_string : Buffer.from(data).toString('utf-8').replace(/(\r\n\t|\n|\r\t)/gm,""),
                                            date_time: new Date(),
                                            inline_name: inline_msg.inline_name,
                                            status_name: (Buffer.from(data).toString('utf-8')).split(':')[0],
                                            status_info: (Buffer.from(data).toString('utf-8')).split(':')[1].replace(/(\r\n\t|\n|\r\t)/gm,""),
                                            duration: inline_msg.duration
                                        }

                                        if(inline_details.status_name == 'Status Changed'){
                                            connection.query({
                                                sql: 'INSERT INTO tbl_inline_quick_change SET date_time = ?, inline_name = ?, status_name = ?, status_info = ?, duration = ? ',
                                                values: [inline_details.date_time, inline_details.inline_name, inline_details.status_name, inline_details.status_info, inline_details.duration]
                                            },  function(err){
                                                if(err){return socket.emit('inline-thread-alert', {alert: 'Error inserting data to table.'})};
            
                                                console.log(inline_details);
                                                socket.emit('inline-thread-response', { message: inline_details});
            
                                            });
    
                                        } else if(inline_details.status_name == 'Status Reverted'){
                                            connection.query({
                                                sql: 'INSERT INTO tbl_inline_quick_change SET date_time = ?, inline_name = ?, status_name = ?, status_info = ?, duration = ? ',
                                                values: [inline_details.date_time, inline_details.inline_name, inline_details.status_name, inline_details.status_info, inline_details.duration]
                                            },  function(err){
                                                if(err){return socket.emit('inline-thread-alert', {alert: 'Error inserting data to table.'})};
            
                                                console.log(inline_details);
                                                socket.emit('inline-thread-response', { message: inline_details});
        
                                                connection.release();
            
                                            });
    
                                        }

                                    });
                                    stream.stderr.on('data', function(data){
                                        console.log('STDERR: '+ data);
                                    });
                                    stream.on('close', function(code, signal){
                                        //console.log('Process closed with code ' + code);
                    
                                        conn.end();
                                    });
                                });
                    
                            }).connect({
                                host: sshConfig.host,
                                port: sshConfig.port,
                                username: sshConfig.username,
                                privateKey: sshConfig.privateKey
                            });
                        }

                    } else {

                        conn.on('ready', function(){ // connect to ssh
                            console.log('SSH client :: open for ' + inline_msg.inline_name );

                            // connect via ssh
                            conn.shell(function(err, stream) {
                                if (err) throw err; // for the meantime.
                
                                stream.on('data', function(data) {
                                    //console.log('STDOUT: ' + data);
                                });
                                stream.stderr.on('data', function(data) {
                                    console.log('STDERR: ' + data);
                
                                });
                                stream.on('close', function() {
                                    console.log('SSH client :: closed for ' + inline_msg.inline_name);
                                });
                
                            });
                
                            // execute bash file under ssh client
                            conn.exec(sshFilePathExecute, function(err, stream){
                                if(err) throw err; // for the meantime.
                
                                stream.on('data', function(data){

                                    let inline_details = {
                                        cli: data,
                                        buffer_to_string : Buffer.from(data).toString('utf-8').replace(/(\r\n\t|\n|\r\t)/gm,""),
                                        date_time: new Date(),
                                        inline_name: inline_msg.inline_name,
                                        status_name: (Buffer.from(data).toString('utf-8')).split(':')[0],
                                        status_info: (Buffer.from(data).toString('utf-8')).split(':')[1].replace(/(\r\n\t|\n|\r\t)/gm,""),
                                        duration: inline_msg.duration
                                    }

                                    if(inline_details.status_name == 'Status Changed'){
                                        connection.query({
                                            sql: 'INSERT INTO tbl_inline_quick_change SET date_time = ?, inline_name = ?, status_name = ?, status_info = ?, duration = ? ',
                                            values: [inline_details.date_time, inline_details.inline_name, inline_details.status_name, inline_details.status_info, inline_details.duration]
                                        },  function(err){
                                            if(err){return socket.emit('inline-thread-alert', {alert: 'Error inserting data to table.'})};
        
                                            console.log(inline_details);
                                            socket.emit('inline-thread-response', { message: inline_details});
        
                                        });

                                    } else if(inline_details.status_name == 'Status Reverted'){
                                        connection.query({
                                            sql: 'INSERT INTO tbl_inline_quick_change SET date_time = ?, inline_name = ?, status_name = ?, status_info = ?, duration = ? ',
                                            values: [inline_details.date_time, inline_details.inline_name, inline_details.status_name, inline_details.status_info, inline_details.duration]
                                        },  function(err){
                                            if(err){return socket.emit('inline-thread-alert', {alert: 'Error inserting data to table.'})};
        
                                            console.log(inline_details);
                                            socket.emit('inline-thread-response', { message: inline_details});
    
                                            connection.release();
        
                                        });

                                    }

                                });
                                stream.stderr.on('data', function(data){
                                    console.log('STDERR: '+ data);
                                });
                                stream.on('close', function(code, signal){
                                    //console.log('Process closed with code ' + code);
                
                                    conn.end();
                                });
                            });
                
                        }).connect({
                            host: sshConfig.host,
                            port: sshConfig.port,
                            username: sshConfig.username,
                            privateKey: sshConfig.privateKey
                        });

                    }
                    
                });

            });

        });

    });


        

}