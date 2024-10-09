const requireAuth = (req, res, next) => {
  if ((req.session && req.session.user) || req.user) {
    const user = req.session.user || req.user;
    if (user.isBlocked) {
      req.flash('error', 'Your account has been blocked');
      return res.redirect('/login');
    } else {
      next();
    }
  } else {
    return res.redirect('/login');
  }
};

module.exports = {
  requireAuth,
};
