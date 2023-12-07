const mongoose = require('mongoose');

const Admin = require('../models/admin');

let createAdmin = async (name, email, password) => {
    const admin = new Admin({ name, email, password });
    try {
        await admin.save();
        return admin;
    } catch (e) {
        return e;
    }
}

module.exports = { createAdmin };