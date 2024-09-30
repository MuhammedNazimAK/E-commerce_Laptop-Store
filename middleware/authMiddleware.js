const addUserToLocals = (req, res, next) => {
  res.locals.userLoggedIn = req.session.user ? true : false;
  next();
};

module.exports = { addUserToLocals };
