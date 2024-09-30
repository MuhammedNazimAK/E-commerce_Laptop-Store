const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel');
require('dotenv').config();



passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
},

async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      return done(null, user);
    } else {
      user = await User.findOne({ email: profile.emails[0].value });

      if (user) {
        user.googleId = profile.id;
        await user.save();
        return done(null, user);
      } else {
        user = new User({
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          email: profile.emails[0].value,
          googleId: profile.id,
        });
        
        await user.save();
        return done(null, user);
      }
    }
  } catch (error) {
    console.error("Error in Google Strategy:", error);
    return done(error, null);
  }
}
));


passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      console.error("Deserialization error:", err);
      done(err, null);
    });
});


module.exports = passport;