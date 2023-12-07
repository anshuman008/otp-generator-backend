const User = require('../models/user');
const mongoose = require('mongoose');

// create a function to search user by email
let searchUser = async (email) => {
    const user = await User.findOne({ email });
    if (!user) {
        return null
    }
    return user;
}

let createUser = async (name, email, password) => {
    const user = new User({ name, email, password });
    try {
        await user.save();
        return user;
    } catch (e) {
        return e;
    }
}

let checkIsPasswordChanged = async (email) => {
    const user = searchUser(email);
    if (!user) {
        return null
    }
    return user.isPasswordChanged;
}

module.exports = { searchUser, createUser, checkIsPasswordChanged };