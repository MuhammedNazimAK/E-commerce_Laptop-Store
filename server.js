const express = require("express");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const path = require("path");
const nocache = require("nocache");
const morgan = require('morgan');
require('dotenv').config();
const passport = require('./config/passport');
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const addressRoutes = require("./routes/addressRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require('./routes/adminRoutes');
const flash = require('connect-flash');

const PORT = process.env.PORT || 3000;
const app = express();

connectDB();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.json({ limit: '50mb', extended: true }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'adminPublic')));
app.use(nocache());

app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 72 * 60 * 60 * 1000, sameSite: 'lax' },
  })
);

app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'public/tmp'),
}));

app.use(flash());
app.use(morgan('dev'));

app.use(passport.initialize());
app.use(passport.session());

app.use("/", userRoutes);
app.use("/", productRoutes);
app.use("/", addressRoutes);
app.use("/", orderRoutes);
app.use("/admin", adminRoutes);


app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
