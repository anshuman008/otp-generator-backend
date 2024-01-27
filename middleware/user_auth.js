const jwt = require('jsonwebtoken');
const User = require('../models/user');

const user_auth = async (req, res, next) => {
    try {
        if (req.headers && req.headers.authorization) {
            const token = req.headers.authorization.replace('Bearer ', '');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findOne({ _id: decoded._id, 'tokens.token': token });
            if (!user) {
                throw new Error();
            }
            req.token = token;
            req.user = user;
            next();
        } else {
            throw new Error('Authorization header is missing');
        }
    } catch (e) {
        if (res && typeof res.status === 'function') {
            res.status(401).send({ error: 'please login', response_code: 401 });
        } else {
            console.error('Error handling authentication:', e.message);
            next(e);
        }
    }
};

module.exports = user_auth;
