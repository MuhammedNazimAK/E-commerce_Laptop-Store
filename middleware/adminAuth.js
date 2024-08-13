const requireAuth = (req, res, next) => {
  if (req.session && req.session.admin) {
    if (req.session.admin.blocked) {
      req.session.destroy((err) => {
        if (err) console.error("Session destruction error:", err);
        return res.redirect("/admin/login?message=Your account has been blocked");
      });
    } else {
      next();
    }
  } else {
    return res.redirect("/admin/login");
  }
};

const requireNoAuth = (req, res, next) => {
  if (req.session && req.session.admin) {
    return res.redirect("/admin/dashboard");
  } else {
    return next();
  }
};

module.exports = {
  requireAuth,
  requireNoAuth,
};
