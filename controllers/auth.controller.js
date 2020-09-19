const User = require('../models/auth.model');
const expressJwt = require('express-jwt');
const _ = require('lodash');
const {OAuth2Client} = require('google-auth-library');
const fetch = require('node-fetch');
const {validationResult} = require('express-validator');
const jwt = require('jsonwebtoken');
// Custom error handler to get useful error from database errors
const {errorHandler} = require('../helpers/dbErrorHandling');
// I will use for send email sendgrid you can use nodemail also
const sgMail = require('@sendgrid/mail');
const { json } = require('body-parser');
sgMail.setApiKey(process.env.MAIL_KEY);

exports.registerController = (req, res) => {
  const { name, email, password } = req.body;
  const errors = validationResult(req);

  // Validation to req.body we will create custom validation in seconds 
  if(!errors.isEmpty()) {
    const firstError = errors.array().map(error => error.msg)[0];
    return res.status(422).json({
      error: firstError
    })
  } else {
    User.findOne({
      email
    }).exec((err, user) => {
      // If user exists
      if (user) {
        return res.status(400).json({
          error: "Email is taken"
        })
      }
    })

    //Generate Token
    const token = jwt.sign(
      {
        name,
        email,
        password
      },
      process.env.JWT_ACCOUNT_ACTIVATION,
      {
        expiresIn: '15m'
      }
    )

    // Email data sending
    const emailData = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Account activation link',
      html: `
        <h1>Please Click to link to activate</h1>
        <a>${process.env.CLIENT_URL}/users/activate/${token}</a>
        <hr/>
        <p>This mail contain sensetive info</P>
        <a>${process.env.CLIENT_URL}</a>
      `
    }

    sgMail.send(emailData).then(sent => {
      return res.json({
        message: `Email has been sent to ${email}`
      })
    }).catch(err => {
      console.log(err);
      return res.status(400).json({
        error: errorHandler(err)
      })
    })
  }
}

// Register For Backend done let's create for it 


// npm i express-jwt lodash google-auth-library node-fetch express-validator jsonwebtoken @sendgrid/mail


// Activation and save to database 
exports.activationController = (req, res) => {
  const { token } = req.body;

  if (token) {
    jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, (err, decoded) => {
      if (err) {
        console.log('Activation error');
        return res.status(401).json({
          errors: 'Expired link. Signup again'
        });
      } else {
        const { name, email, password } = jwt.decode(token);

        console.log(email);
        const user = new User({
          name,
          email,
          password
        });

        user.save((err, user) => {
          if (err) {
            console.log('Save error', errorHandler(err));
            return res.status(401).json({
              errors: errorHandler(err)
            });
          } else {
            return res.json({
              success: true,
              message: 'Signup success',
            });
          }
        });
      }
    });
  } else {
    return res.json({
      message: 'error happening please try again'
    });
  }
};



exports.loginController = (req, res) => {
  const {email, password} = req.body;
  const errors = validationResult(req);

  // Validation to req.body we will create custom validation in seconds 
  if(!errors.isEmpty()) {
    const firstError = errors.array().map(error => error.msg)[0];
    return res.status(422).json({
      error: firstError
    })
  } else {
    // Check if user exist 
    User.findOne({
      email
    }).exec((err,user) => {
      if(err || !user) {
        return res.status(400).json({
          error: 'User with that email does not exist, Please Sign up'
        })
      }

      // Authenticate 
      if(!user.authenticate(password)) {
        return res.status(400).json({
          error: 'Email and Password do not match'
        })
      }

      // Generate Token
      const token = jwt.sign(
        {
          _id: user._id
        }, process.env.JWT_SECRET,
        {
          expiresIn: '7d' // Token valid in 7 days you can set remember me in front and set it for 30d
        }
      )

      const { 
        _id, 
        name, 
        email, 
        role 
      } = user
      return res.json({
        token,
        user: {
          _id,
          name,
          email,
          role
        }
      })
    })
  }
}


exports.forgetController = (req, res) => {
  const {email} = req.body;
  const errors = validationResult(req);

  // Validation to req.body we will create custom validation in seconds 
  if(!errors.isEmpty()) {
    const firstError = errors.array().map(error => error.msg)[0];
    return res.status(422).json({
      error: firstError
    })
  } else {
    // Find if user exists
    User.findOne({email}, (err,user) => {
      if(err || !user) {
        return res.status(400).json({
          error: 'User with that email does not exist'
        })
      }

      // If exist 
       // Generate token for user with this id valid for only 10 min
      const token = jwt.sign({
        _id: user._id
      }, process.env.JWT_RESET_PASSWORD, {
        expiresIn: '10m'
      })

      // Send email with this token
      const emailData = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Password Reset link',
        html: `
          <h1>Please Click to link to reset your password</h1>
          <a>${process.env.CLIENT_URL}/users/password/reset/${token}</a>
          <hr/>
          <p>This mail contain sensetive info</P>
          <a>${process.env.CLIENT_URL}</a>
        `
      }

      return user.updateOne({
          resetPasswordLink: token,
        }, (err, success) => {
          if(err) {
            return res.status(400).json({
              error:errorHandler(err)
            })
          } else {
            // Send email
            sgMail.send(emailData).then(sent => {
              return res.json({
                message: `Email has been sent to ${email}`
              })
            })
            .catch(err => {
              return res.json({
                message: err.message
              })
            })
          }
        }
      )

    })
  }
}


exports.resetController = (req, res) => {
  const {resetPasswordLink, newPassword} = req.body;
  const errors = validationResult(req);

  // Validation to req.body we will create custom validation in seconds 
  if(!errors.isEmpty()) {
    const firstError = errors.array().map(error => error.msg)[0];
    return res.status(422).json({
      error: firstError
    })
  }  else {
    if(resetPasswordLink) {
      jwt.verify(resetPasswordLink, process.env.JWT_RESET_PASSWORD, function(err, decoded) {
        if (err) {
          return res.status(400).json({
            error: 'Expired Link, try again'
          })
        }

        User.findOne({resetPasswordLink}, (err, user) => {
          if(err || !user) {
            return res.status(400).json({
                error : 'Something went wrong. Try later'
            })
          }

          const updatedFields = {
            password: newPassword,
            resetPasswordLinke: ""
          }

          user = _.extend(user, updatedFields);

          user.save((err, result) => {
            if(err) {
              return res.status(400).json({
                error : 'Error reseting user password'
              })
            }

            res.json({
              message: 'Great! Now you can login with new password'
            })
          })
        })
      })
    }
  }
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT)
exports.googleController = (req, res) => {
  const {idToken} = req.body
  //Get Token from request

  // Verify token 
  client
    .verifyIdToken({idToken, audience: process.env.GOOGLE_CLIENT})
    .then(response => {
      const {
        email_verified, 
        name, 
        email
      } = response.payload

      //Check if email verified
      if(email_verified) {
        User.findOne({email}).exec((err, user) => {
          // Find if this email already exists
          if(user) {
            const token = jwt.sign({_id: user.id}, process.env.JWT_SECRET, {
              expiresIn: '7d'  // valid token for 7 days
            })

            const {_id, email, name, role} = user;
            // send response to client side(react) token and user info
            return res.json({
              token,
              user:{_id, email, name, role}
            })
          } else {
            // If user not exists we will save in database and generate password for it 
            let password = email + process.env.JWT_SECRET;
            user = new User({name, email, password}) // create user object with this email
            user.save((err, data) => {
              if (err) {
                return res.status(400).json({
                  error : errorHandler(err)
                })
              } 

              // If no error, generate token 
              const token = jwt.sign(
                {_id: data._id},
                process.env.JWT_SECRET,
                {expiresIn: '7d'}
              )
              const {_id, email, name, role} = data;
              return res.json({
                token,
                user: {_id, email, name, role}
              })
            })
          }
        })
      } else {
        // If error 
        return res.status(400).json({
          error: 'Google login failed, try again'
        })
      }
    })
}

exports.facebookController = (req, res) => {
  const {userID, accessToken} = req.body // Get id and token from react 
  const url = `https://graph.facebook.com/v2.11/${userID}?fields=id,name,email&access_token=${accessToken}`;

  // get from facebook 
  return (
    fetch(url, {
      method: 'GET'
    }).then(response => response.json())
      .then(response => {
        const { email, name } = response; // Get email and password from facebook
        User.findOne({email}).exec((err, user) => {
          // Check if this account with this email already exists
          if(user) {
            const token = jwt.sign(
              {_id: user._id},
              process.env.JWT_SECRET,
              {expiresIn: '7d'}
            ); 
            const {_id, email, name, role} = user;
              return res.json({
                token,
                user: {_id, email, name, role}
              })
          } else {
            let password = email + process.env.JWT_SECRET // Generate password and save to database as new user 
            user = new User({name, email, password})
            user.save((err, data) => {
              if(err) {
                return res.status(400).json({
                  error : 'User signup failed with facebook'
                })
              }


              //if no error 
              const token = jwt.sign({_id: data._id, }, process.env.JWT_SECRET, {expiresIn: '7d'})
              const {_id, email, name, role} = data;
              return res.json({
                token,
                user: {_id, email, name, role}
              });
            })
          }
        })
      }).catch(error => {
        res.json({error: 'Facebook login failed. Try later'})
      })
  )

}


// Let's implement in client sid 