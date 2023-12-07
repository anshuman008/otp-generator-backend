const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
    name: {
        type: String,
        default: 'Admin'
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String
    },
    tokens: [{
        token: {
            type: String,
            required: true
        }
    }]
});

adminSchema.methods.toJSON = function () {
    const admin = this;
    const adminObject = admin.toObject();
    delete adminObject.password;
    delete adminObject.tokens;
    return adminObject;
}

adminSchema.methods.generateAuthToken = async function () {
    const admin = this;
    const token = jwt.sign({ _id: admin._id.toString() }, process.env.JWT_SECRET);
    admin.tokens = admin.tokens.concat({ token });
    await admin.save();
    return token;
}

adminSchema.statics.findByCredentials = async (email, password) => {
    const admin = await Admin.findOne({ email });
    if (!admin) {
        throw new Error('Unable to login');
    }

    let isMatch = false

    if (password == admin.password) {
        isMatch = true
    }
    else if (bcrypt.compare(password, admin.password)) {
        isMatch = true
    }

    if (!isMatch) {
        throw new Error('Unable to login');
    }
    return admin;
}

adminSchema.pre('save', async function (next) {
    const admin = this;
    if (admin.isModified('password')) {
        admin.password = await bcrypt.hash(admin.password, 8);
    }
    next();
}
);


const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;