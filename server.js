// Packages
const express = require("express");
const fs = require('fs');
const session = require('express-session')
const passport = require('passport')
const parser = require("body-parser");
const fileUpload = require('express-fileupload');
const path = require("path");
const { v4: uuidv4 } = require('uuid');

// Database for logged in clients
let clients = {};

// Server Config and OAuth Strategy
const config = require('./config.js').config;

// Session info
const sessionStore = new session.MemoryStore();
const expressSession = session({
    name: config.app.session.name,
    store: sessionStore,
    secret: config.app.session.secret,
    resave: true,
    saveUninitialized: true,
    cookie: {
        path: '/',
        httpOnly: true,
        secure: config.app.session.requireHTTPS,
        maxAge: config.app.session.maxAge
    }
});

// Application creation
const app = express();
app.use(express.static('public'));
app.use(fileUpload());
app.use(parser.json());
app.use(expressSession);
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'pug')
app.listen(config.app.port, () => { console.log(`Server started on port ${config.app.port}`) })
console.log(`Address: http://10.50.43.181:${config.app.port}/`);

// Google OAuth Strategy
const oauth = config.oauth2;
let GoogleStrategy = require('passport-google-oauth20').Strategy;
passport.use(new GoogleStrategy({
    clientID: oauth.clientID,
    clientSecret: oauth.clientSecret,
    callbackURL: oauth.callbackURL
},
    function (accessToken, refreshToken, profile, done) {
        done(null, profile)
    }
));

// Setup the OAuth provider (Google)
let provider = {
    name: oauth.name,
    callbackURL: oauth.callbackURL,
    provider: "google"
}
app.get("/auth/google", passport.authenticate('google', { scope: ['email', 'profile'] }))
app.get(provider.callbackURL,
    passport.authenticate("google", { failureRedirect: '/' }),
    function (req, res) {
        const id = req.user.emails[0].value; // Using email as ID
        if (!clients[id]) { // Add client to database
            clients[id] = {};
            if (!fs.existsSync(`./Database/${id}`)) {
                fs.mkdirSync(`./Database/${id}`);
            }
            else { // Check for pre-existing projects
                const projects = fs.readdirSync(`./Database/${id}`);
                for (let project of projects) {
                    clients[id][project] = { owner: id, path: `./Database/${id}/${project}` };
                }
            }
        }

        console.log("Clients: " + JSON.stringify(clients));
        res.redirect(`/profile`);
    }
);
passport.serializeUser(function (user, done) { done(null, user); });
passport.deserializeUser(function (user, done) { done(null, user); });

// Fetch Requests
app.get("/", (req, res) => { // Home page
    res.sendFile("/index.html", { root: __dirname });
});

app.get("/profile", function (req, res) { // Profile page
    if (!req.user) { res.redirect('/'); }
    res.sendFile("profile.html", { root: __dirname });
});

app.get("/profile/info", function (req, res) { // Grabbing profile info
    if (!req.user) { res.redirect('/'); }
    const id = req.user.emails[0].value;

    let data = { name: req.user.displayName, projects: {} };
    for (let project in clients[id]) {
        data.projects[project] = JSON.parse(fs.readFileSync(`./Database/${id}/${project}/config.json`));
    }

    res.send(JSON.stringify(data));
});

app.post("/new", (req, res) => { // Creating a new project in the database
    if (!req.user) { res.redirect('/'); }
    const id = req.user.emails[0].value;

    const projectID = uuidv4();
    fs.mkdirSync(`./Database/${id}/${projectID}`);
    clients[id][projectID] = { owner: id, path: `./Database/${id}/${projectID}` };

    // Assets folder, config file, and scene file
    fs.mkdirSync(`./Database/${id}/${projectID}/Assets`);
    fs.copyFile("public/Assets/Sprites/Square.png", `./Database/${id}/${projectID}/Assets/Square.png`, (error) => { } );
    fs.copyFile("public/Assets/Sprites/Circle.png", `./Database/${id}/${projectID}/Assets/Circle.png`, (error) => { } );
    fs.copyFile("public/Assets/Sprites/Triangle.png", `./Database/${id}/${projectID}/Assets/Triangle.png`, (error) => { } );
    let config = { name: req.body.name, description: req.body.description };
    fs.writeFileSync(`./Database/${id}/${projectID}/config.json`, JSON.stringify(config));
    fs.writeFileSync(`./Database/${id}/${projectID}/scene.json`, JSON.stringify({ entities: [] }));

    let data = { name: req.user.displayName, projects: {} };
    for (let project in clients[id]) {
        data.projects[project] = JSON.parse(fs.readFileSync(`./Database/${id}/${project}/config.json`));
    }

    res.send(JSON.stringify(data));
});

app.get("/project/:projectID", (req, res) => { // Opening the game engine
    if (!req.user) { res.redirect('/'); }
    res.sendFile("public/engine.html", { root: __dirname });
});

app.post("/save", (req, res) => { // Save current project scene data to the database
    if (!req.user) { res.redirect('/'); }
    const id = req.user.emails[0].value;

    fs.writeFileSync(`./Database/${id}/${req.body.projectID}/scene.json`, JSON.stringify(req.body.project));
    res.end();
});

app.post("/load", (req, res) => { // Load the current project scene data from the database
    if (!req.user) { res.redirect('/'); }
    const id = req.user.emails[0].value;

    const data = JSON.parse(fs.readFileSync(`./Database/${id}/${req.body.projectID}/scene.json`));
    res.send(JSON.stringify(data));
});

app.post("/files", (req, res) => { // Request list of files in the database
    if (!req.user) { res.redirect('/'); }
    const id = req.user.emails[0].value;

    const files = fs.readdirSync(`./Database/${id}/${req.body.projectID}/Assets`);
    res.send(JSON.stringify({ files: files }));
});

app.post("/project/:projectID/upload", (req, res) => { // Upload assets to the database
    if (!req.user) { res.redirect('/'); }
    const id = req.user.emails[0].value;

    let asset = req.files.file;
    asset.mv(`./Database/${id}/${req.params.projectID}/Assets/` + asset.name, function (err) {
        if (err) { console.log(err); } else { console.log("Asset Uploaded"); }
    });

    res.end();
});

app.get("/project/:projectID/file/:fileName", (req, res) => { // Request a file from the database
    if (!req.user) { res.redirect('/'); }
    const id = req.user.emails[0].value;

    res.sendFile(`./Database/${id}/${req.params.projectID}/Assets/${req.params.fileName}`, { root: __dirname });
});

app.get("/test", (req, res) => { // Send the engine over (no requirements)
    res.sendFile("public/engine.html", { root: __dirname });
});