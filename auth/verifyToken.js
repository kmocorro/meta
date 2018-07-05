let jwt = require('jsonwebtoken');
let config = require('./config');

/**
 * 
 * @param {userID, claim} req 
 *  
 */
function verifyToken(req, res, next){
    let token = req.cookies.auth;
    if(!token){
        return res.status(200).render('login');
    } else {
        // cookies.auth is available, verify.
        jwt.verify(token, config.secret, function(err, decoded){

            if(err){
                return res.status(200).render('login');
            } else {
                req.userID = decoded.id;
                req.claim = decoded.claim;
                next();
            }

        });
    }
}

module.exports = verifyToken;