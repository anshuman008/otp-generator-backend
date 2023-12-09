const mongoose = require('mongoose');
const express = require('express');
const router = new express.Router();

const User = require('../models/user');
const Log = require('../models/log');

const auth = require('../middleware/user_auth');

const { checkIsPasswordChanged } = require('../controllers/user');

// login
router.post('/user/login', async (req, res) => {
    try {
        const user = await User.findByCredentials(req.body.email, req.body.password);
        const token = await user.generateAuthToken();
        res.send({ user, token });
    } catch (e) {
        console.log(e, 'error')
        res.status(400).send(e);
    }
}
);

// logout
router.post('/user/logout', auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token !== req.token;
        });
        await req.user.save();
        res.send();
    } catch (e) {
        res.status(500).send();
    }
});

// logout from all devices
router.post('/user/logoutAll', auth, async (req, res) => {
    try {
        req.user.tokens = [];
        await req.user.save();
        res.send();
    } catch (e) {
        res.status(500).send();
    }
});

// get user profile
router.get('/user/me', auth, async (req, res) => {
    if (!req.user.isPasswordChanged) {
       return res.status(401).send({ error: 'Please change your password' , user: req.user});
    }
    res.send({user: req.user});
});

// update user profile
router.patch('/user/me', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'password'];
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));
    if (!isValidOperation) {
        console.log('in 1')
        return res.status(400).send();
    }
    try {
        updates.forEach((update) => req.user[update] = req.body[update]);
        console.log(updates, 'update')
        if(updates?.includes('password')) {
            req.user.isPasswordChanged = true
        }
        await req.user.save();
        res.send({user: req.user});
    } catch (e) {
        console.log(e, 'e')
        res.status(400).send();
    }
});

// get logs of user
router.get('/user/me/logs', auth, async (req, res) => {
    if (!req.user.isPasswordChanged) {
       return res.status(401).send({ error: 'Please change your password' , user: req.user});
    }
    try {
        const logs = await Log.find({ userID: req.user._id });
        res.send(logs);
    } catch (e) {
        res.status(500).send();
    }
});

module.exports = router;