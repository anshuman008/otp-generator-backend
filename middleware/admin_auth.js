const jwt = require('jsonwebtoken')
const Admin = require('../models/admin')

const admin_auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '')
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const admin = await Admin.findOne({ _id: decoded._id, 'tokens.token': token })
        if (!Admin) {
            throw new Error()
        }
        req.token = token
        req.admin = admin
        next()
    } catch (e) {
        res.status(401).send({ error: 'please login', response_code: 401 })
    }
}

module.exports = admin_auth