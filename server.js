const express = require("express");
const app = express();
const path = require("path");
const ejs = require("ejs");
const bcrypt = require("bcrypt");
const collection = require("./mongodb");
const multer = require("multer");
const session = require("express-session");
const MongoStore = require("connect-mongo");

require('dotenv').config()
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use('/profile_pictures',express.static("profile_pictures"));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "profile_pictures");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});


const upload = multer({ storage: storage });

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 
    }
}));


const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        res.redirect('/home');
    } else {
        next();
    }
};

const isNotAuthenticated = (req, res, next) => {
    if (!req.session.userId) {
        res.redirect('/login');
    } else {
        next();
    }
};

app.set("view engine", "ejs");

app.get('/', (req, res) => {
    res.redirect('/login');
  });

app.get('/home', async (req, res) => {
    if (req.session.userId) {
        try {
            const user = await collection.findById(req.session.userId);
            res.render('index', { user });
        } catch (e) {
            console.log(e);
            res.status(500).send('Internal Server Error');
        }
    } else {
        res.redirect('/login');
    }
});

app.get('/login',isAuthenticated, (req, res) => {
    res.render("login.ejs");
});

app.post('/login', isAuthenticated, async (req, res) => {
    try {
        const check = await collection.findOne({ email: req.body.email });

        if (!check) {
            return res.status(400).send({ message: "User does not exist. Please register before login!" });
        }

        const isPasswordMatch = await bcrypt.compare(req.body.password, check.password);

        if (isPasswordMatch) {
            req.session.userId = check._id;
            res.redirect("/home");
        } else {
            return res.status(400).send({ message: "Incorrect Password!" });
        }
    } catch (e) {
        console.log(e);
        res.status(500).send({ message: "Internal Server Error" });
    }
});


app.get('/register',isAuthenticated, (req, res) => {
    res.render("register.ejs");
});

app.post('/register',isAuthenticated, upload.single("profilePicture"), async (req, res) => {
    try {
        const profilePic = req.file ? req.file.path : null;
        const data = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            mobileNo: req.body.mobileNo,
            email: req.body.email,
            password: req.body.password,
            profilePicture: profilePic
        };

        const existingUser = await collection.findOne({ email: data.email });
        if (existingUser) {
            return res.send("User already exists! Cannot register");
        } else {
            const hashedPassword = await bcrypt.hash(data.password, 10);
            data.password = hashedPassword;
            const userdata = await collection.insertMany([data]);
            console.log(userdata);
            res.redirect("/login");
        }
    } catch (e) {
        console.log(e);
        res.redirect("/register");
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect("/home");
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

app.listen(port, () => {
    console.log("Server is running on port 3000");
});
