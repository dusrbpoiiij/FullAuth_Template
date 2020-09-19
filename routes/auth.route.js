const express = require('express');
const router = express.Router();

// Validation
const{
  validRegister,
  validLogin,
  forgotPasswordValidator,
  resetPasswordValidator
} = require('../helpers/valid')

// Load Controllers
const {
  registerController,
  activationController,
  loginController,
  forgetController,
  resetController,
  googleController,
  facebookController
} = require('../controllers/auth.controller.js')

router.post('/register', validRegister, registerController);
router.post('/login',validLogin, loginController);
router.post('/activation',activationController);
router.put('/password/forget', forgotPasswordValidator, forgetController)
router.put('/password/reset', resetPasswordValidator, resetController)

// implement social login google and facebook
// First routes 
router.post('/googlelogin', googleController)

// Now let's implement the backend 
router.post('/facebooklogin', facebookController)
module.exports = router;