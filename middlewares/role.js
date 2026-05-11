const result = require('../utils/result')

const checkOwner = ( req , res , next ) => {
    if(req.user.role === 'owner')
        return next()
    else{
        return res.send(result.createResult(" Unauthorized access !"))
    }
}

const checkUser = ( req , res , next ) => {
    if(req.user.role === 'user')
        return next()
    else 
        return res.send(result.createResult("Unauthorized access !"))
    
}

const checkAdmin = ( req , res , next ) => {
    if(req.user.role === 'super_admin')
        return next()
    else 
        return res.send(result.createResult("Unauthorized access !"))
}

const checkSubAdmin = (req , res , next ) => {
    if(req.user.role === 'sub_admin' || req.user.role === 'super_admin')        
        return next()
    else 
        return res.send(result.createResult("Unauthorized access !"))
}

module.exports = { checkOwner , checkUser , checkAdmin , checkSubAdmin }