const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    if (req.session.user.blocked) {
      req.session.destroy((err) => {
        if (err) console.error("Session destruction error:", err);
        return res.redirect("/login?message=Your account has been blocked");
      });
    } else {
      next();
    }
  } else {
      return res.redirect("/login");
  }
};

const requireNoAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect("/home");
  } else {
    return next();
  }
};

module.exports = {
  requireAuth,
  requireNoAuth,
};
