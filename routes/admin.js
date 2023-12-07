const express = require('express');
const router = new express.Router();

const Admin = require('../models/admin');
const Log = require('../models/log');

const auth = require('../middleware/admin_auth');

const { searchUser, createUser } = require('../controllers/user');

// login
router.post('/admin/login', async (req, res) => {
    try {
        const admin = await Admin.findByCredentials(req.body.email, req.body.password);
        const token = await admin.generateAuthToken();
        res.send({ admin, token });
    } catch (e) {
        console.log(e,' e')
        res.status(400).send(e);
    }
}
);

// logout
router.post('/admin/logout', auth, async (req, res) => {
    try {
        req.admin.tokens = req.admin.tokens.filter((token) => {
            return token.token !== req.token;
        });
        await req.admin.save();
        res.send();
    } catch (e) {
        res.status(500).send();
    }
});

// logout from all devices
router.post('/admin/logoutAll', auth, async (req, res) => {
    try {
        req.admin.tokens = [];
        await req.admin.save();
        res.send();
    } catch (e) {
        res.status(500).send();
    }
});

// get admin profile
router.get('/admin/me', auth, async (req, res) => {
    res.send(req.admin);
});

// update admin profile
router.patch('/admin/me', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'password'];
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));
    if (!isValidOperation) {
        return res.status(400).send();
    }
    try {
        updates.forEach((update) => req.admin[update] = req.body[update]);
        await req.admin.save();
        res.send(req.admin);
    } catch (e) {
        res.status(400).send(e);
    }
});

// search user by email
router.get('/admin/searchUser/:email', auth, async (req, res) => {
    try {
        const user = await searchUser(req.params.email);
        if (!user) {
            return res.status(404).send();
        }
        res.send(user);
    } catch (e) {
        res.status(500).send();
    }
});

// recharge user's account
router.post('/admin/rechargeUser', auth, async (req, res) => {
    const { email, amount } = req.body;
    try {
        const user = await searchUser(email);
        if (!user) {
            return res.status(404).send();
        }
        user.money.inAccount += amount;
        await user.save();
        res.send(user);
    } catch (e) {
        res.status(500).send();
    }
})

// get all logs
router.get('/admin/logs', auth, async (req, res) => {
    try {
        const logs = await Log.find({});
        res.send(logs);
    } catch (e) {
        res.status(500).send();
    }
});

// get logs of a user
router.get('/admin/logs/:email', auth, async (req, res) => {
    try {
        const user = await searchUser(req.params.email);
        if (!user) {
            return res.status(404).send();
        }
        await user.populate('logs').execPopulate();
        res.send(user.logs);
    } catch (e) {
        res.status(500).send();
    }
});

// create a user
router.post('/admin/createUser', auth, async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const user = await createUser(name, email, password);
        if (!user) {
            return res.status(400).send();
        }
        res.send(user);
    } catch (e) {
        res.status(500).send();
    }
});

// create a admin
router.post('/admin/createAdmin', auth, async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const admin = await createAdmin(name, email, password);
        if (!admin) {
            return res.status(400).send();
        }
        res.send(admin);
    } catch (e) {
        res.status(500).send();
    }
});

module.exports = router;