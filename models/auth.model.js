const mongoose = require('mongoose');
const crypto = require('crypto');

// User Schema 
const userSchema = new mongoose.Schema({
  email:{
    type: String,
    trim: true,
    require: true,
    unique: true,
    lowercase: true,
  },
  name: {
    type: String,
    trim: true,
    require: true,
  },
  hashed_password: {
    //I will save as hash after enctypt it we will build function to encrypt
    type: String,
    require: true,
  },
  salt:String,
  role: {
    type: String,
    default: 'Normal'
    // We have more type (normal, admin ...)
  }, 
  resetPasswordLink: {
    data: String,
    default: ""
  }
}, {timestamps: true})

// Virtual Password (비밀번호 암호화 인듯)
userSchema.virtual('password')
  .set(function (password) {
    // set password note you must use normal function not arrow function
    this._password = password;
    this.salt = this.makeSalt();
    this.hashed_password = this.encryptPassword(password);
  })
  .get(function() {
    return this._password
  })

// methods 
userSchema.methods = {
  // Compare password between plain get from user and hashed
  authenticate: function(plainPassword) {
    return this.encryptPassword(plainPassword) === this.hashed_password;
  },

  // Encrypt Password 
  encryptPassword: function (password) {
    if (!password) return "";
    try {
      return crypto
        .createHmac('sha1', this.salt)
        .update(password)
        .digest('hex')
    } catch(err) {
      return "";
    }
  },
  

  // Generate Salt 
  makeSalt: function() {
    return Math.round(new Date().valueOf() * Math.random()) + "";
  }

};

module.exports = mongoose.model('User', userSchema);