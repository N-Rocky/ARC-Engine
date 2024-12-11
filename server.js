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
app.use(parser.json({limit: '1mb'}));
app.use(expressSession);
app.use(passport.initialize());
app.use(passport.session());
app.listen(config.app.port, () => { console.log(`Server started on port ${config.app.port}`) });

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

        //console.log("Clients: " + JSON.stringify(clients));
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
    if (!req.user) { return res.redirect('/'); }
    res.sendFile("profile.html", { root: __dirname });
});

app.get("/profile/info", function (req, res) { // Grabbing profile info
    if (!req.user) { return res.redirect('/'); }
    const id = req.user.emails[0].value;

    let data = { name: req.user.displayName, projects: {} };
    for (let project in clients[id]) {
        data.projects[project] = JSON.parse(fs.readFileSync(`./Database/${id}/${project}/config.json`));
    }

    res.send(JSON.stringify(data));
});

app.post("/new", (req, res) => { // Creating a new project in the database
    if (!req.user) { return res.redirect('/'); }
    const id = req.user.emails[0].value;

    const projectID = uuidv4();
    fs.mkdirSync(`./Database/${id}/${projectID}`);
    clients[id][projectID] = { owner: id, path: `./Database/${id}/${projectID}` };
    const configFile = { name: req.body.name, description: req.body.description,
        cover: "Resources/ProjectIcon.png"
    };

    // Assets folder, config file, and scene file
    fs.mkdirSync(`./Database/${id}/${projectID}/Assets`);
    fs.writeFileSync(`./Database/${id}/${projectID}/config.json`, JSON.stringify(configFile));
    fs.writeFileSync(`./Database/${id}/${projectID}/scene.json`, JSON.stringify({ entities: [] }));

    // Create Asset subfolders based on public subfolders
    for (let folder of fs.readdirSync(`./public/Assets`)) {
        fs.mkdirSync(`./Database/${id}/${projectID}/Assets/${folder}`);
    }

    let data = { name: req.user.displayName, projects: {} };
    for (let project in clients[id]) {
        data.projects[project] = JSON.parse(fs.readFileSync(`./Database/${id}/${project}/config.json`));
    }

    res.send(JSON.stringify(data));
});

app.get("/project/:projectID", (req, res) => { // Opening the game engine
    if (!req.user) { return res.redirect('/'); }
    res.sendFile("public/engine.html", { root: __dirname });
});

app.post("/save", (req, res) => { // Save current project scene data to the database
    if (!req.user) { return res.redirect('/'); }
    const id = req.user.emails[0].value;

    // Saving the scene (direct overwrite)
    fs.writeFileSync(`./Database/${id}/${req.body.projectID}/scene.json`, JSON.stringify(req.body.project));

    // Saving the cover image (update config file)
    const configData = JSON.parse(fs.readFileSync(`./Database/${id}/${req.body.projectID}/config.json`));
    configData.cover = req.body.cover;
    fs.writeFileSync(`./Database/${id}/${req.body.projectID}/config.json`, JSON.stringify(configData));

    res.end();
});

app.post("/load", (req, res) => { // Load the current project scene data from the database
    if (!req.user) { return res.redirect('/'); }
    const id = req.user.emails[0].value;

    const data = JSON.parse(fs.readFileSync(`./Database/${id}/${req.body.projectID}/scene.json`));
    res.send(JSON.stringify(data));
});

app.post("/files", (req, res) => { // Request list of files in the database
    if (!req.user) { return res.redirect('/'); }
    const id = req.user.emails[0].value;

    let files = {};
    const folders = fs.readdirSync(`./Database/${id}/${req.body.projectID}/Assets`);
    for (let folder of folders) {
        files[folder] = fs.readdirSync(`./Database/${id}/${req.body.projectID}/Assets/${folder}`);
        for (let file of fs.readdirSync(`./public/Assets/${folder}`)) {
            files[folder].push(file); // Add public files
        }
    }

    res.send(JSON.stringify({ files: files }));
});

app.post("/project/:projectID/upload", (req, res) => { // Upload assets to the database
    if (!req.user) { return res.redirect('/'); }
    const id = req.user.emails[0].value;

    let asset = req.files.file;

    let fileType = null;
    if ([".png", ".jpg", "jpeg"].includes(asset.name.slice(-4))) { // Supported Images
        fileType = "Images";
    }
    else if ([".mp3", ".wav"].includes(asset.name.slice(-4))) { // Supported Audio
        fileType = "Audio"
    }

    if (fileType != null) { // Uploaded a supported file type
        asset.mv(`./Database/${id}/${req.params.projectID}/Assets/${fileType}/${asset.name}`, function (err) {
            if (err) { console.log(err); } else { console.log("Asset Uploaded"); }
        });
    }

    res.end();
});

app.get("/project/:projectID/file/:folder/:file", (req, res) => { // Request a file from the database
    if (!req.user) { return res.redirect('/'); }
    const id = req.user.emails[0].value;

    for (let file of fs.readdirSync(`./public/Assets/${req.params.folder}`)) { // Search in public
        if (file == req.params.file) {
            res.sendFile(`public/Assets/${req.params.folder}/${file}`, { root: __dirname });
            return;
        }
    }

    res.sendFile(`./Database/${id}/${req.params.projectID}/Assets/${req.params.folder}/${req.params.file}`, { root: __dirname });
});

app.get("/test", (req, res) => { // Send the engine over (no requirements)
    res.sendFile("public/engine.html", { root: __dirname });
});