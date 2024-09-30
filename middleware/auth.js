const requireAuth = (req, res, next) => {
  if ((req.session && req.session.user) || req.user) {
    const user = req.session.user || req.user;
    if (user.isBlocked) {
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


module.exports = {
  requireAuth,
};
