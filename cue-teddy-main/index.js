const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');
const crypto = require('crypto');
const ejs = require('ejs');
const SQL = require('sql-template-strings');
const nodemailer = require('nodemailer');
var mysql = require('mysql');

const oneDay = 1000 * 60 * 60 * 24;
const app = express(); // creates APP, which is the main program
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressSession({ secret: 'mySecret', resave: true, cookie: { maxAge: oneDay }, saveUninitialized: true }));
app.use(cookieParser());
app.set('views', '/views');
app.set('view engine', 'ejs');
//app.use(expressLayouts);

const port = process.env.PORT || 3000; // process.env.PORT for heroku, 3000 for local

const host = process.env.host;
const user = process.env.user;
const pass = process.env.password;
const database = process.env.database;
const secret = process.env.secret;
const emailUser = process.env.emailuser;
const emailPass = process.env.emailpass;

var session;

var con = mysql.createPool({ // start database
    connectionLimit: 5,
    host: host,
    user: user,
    password: pass,
    database: database
});

con.getConnection(function (err) {
    //if (err) throw err;
    console.log("Connected!");
    console.log(database);
});

app.get("/", function (req, res) {
    // add support to navbar
    res.sendFile(__dirname + "/index.html");
})

app.get("/private", function (req, res) { // when a person arrives at the main url + / (so, the home), it makes a request, and sends a response. 
    res.sendFile(__dirname + "/html/private.html"); // sends our html file in a static way
});

app.get("/purchase", function (req, res) {
    res.sendFile(__dirname + "/html/purchase.html");
});

app.get("/daegan", function (req, res) {
    res.sendFile(__dirname + "/html/daegan.html");
});

app.get("/nikha", function (req, res) {
    res.sendFile(__dirname + "/html/nikha.html");
});

app.get("/jake", function (req, res) {
    res.sendFile(__dirname + "/html/jake.html");
});

app.get("/query", function (req, res) {
    const sql = SQL`SELECT forum_reply_test.content, poster_id, reply_id, forum_reply_test.date_created FROM forum_reply_test 
    JOIN forum_thread_test ON forum_thread_test.thread_id = forum_reply_test.thread_id AND forum_reply_test.thread_id = ${15}`;

    con.query(sql, function (err, result) {
        for (var i = 0; i < result.length; i++) {
            res.write("<h1>" + result[i].content + "</h1>");
        }
    });

});

app.get("/signuperror", function (req, res) {
    session = req.session;
    if (!session.err) {
        res.redirect("/404");
        return;
    }

    const ejsArgs = {
        error: session.err
    };

    req.session.destroy(); // destroy so they can't rereach this page

    ejs.renderFile(__dirname + "/views/ejs_signuperror.html", ejsArgs, function (err, html) {
        if (err) console.log(err);
        res.send(html);
    });

});

app.get("/signupsuccess", function (req, res) {
    res.sendFile(__dirname + "/html/signupsuccess.html");
})

app.get("/forum", function (req, res) {
    session = req.session;

    if (!session.username) { // if user is not logged in, send them to login page
        var alertType = session.err;

        if (session.email_registered == 0) {
            alertType = "registered";
        }

        const ejsArgs = {
            alertType: alertType
        }

        ejs.renderFile(__dirname + "/views/ejs_login.html", ejsArgs, function (err, html) {
            if (err) console.log(err);
            res.send(html);
        });

        session.err = "none";
        req.session.save();

        return;
    }

    if (session.currPage == null) { // if user is here by login, set the current page to one
        session.currPage = 1;
    } else { // otherwise, set the current page to the one they just clicked on
        if (req.query.page != null) {
            session.currPage = req.query.page;
        } else {
            session.currPage = 1;
        }
    }

    const sql = "select username, date_created, title, content, thread_id from forum_users_test JOIN forum_threads_test ON creator = username;"
    con.query(sql, function (err, result) {
        if (err) console.log(err);

        threadTitles = [];
        createdUsers = [];
        createdDates = [];
        threadTexts = [];
        threadIDs = [];

        var resultLength = result.length;
        const numOfPages = Math.ceil(resultLength / 10.0); // total number of viewable pages, 10 per page
        const currPage = session.currPage;

        var maxIndex = currPage * 10; // max index, therefore the 10th thread of this page
        if (resultLength < maxIndex) { // if the number of threads is less than the max index, the max is set to the number of threads
            maxIndex = resultLength;
        }

        for (var i = (currPage * 10) - 10; i < maxIndex; i++) { // sends us in the proper page index, if page 1, 0 - 9, if page 2, 10 - 29 and so on
            const j = i % 10; // the curr titles that will be sent by ejs go from 0 - 9 no matter the page
            threadTitles[j] = result[i].title;
            threadTexts[j] = result[i].content;
            createdUsers[j] = result[i].username;

            var id = result[i].thread_id;
            threadIDs[j] = id;

            var date = result[i].date_created
            createdDates[j] = date.toString().slice(0, 16); // cuts off the timezone
        }

        const ejsArgs = {
            user: session.username,
            threadTitles: threadTitles,
            threadIDs: threadIDs,
            createdUsers: createdUsers,
            createdDates: createdDates,
            numOfPages: numOfPages,
            currPage: currPage
        };

        // display number of pages TODO
        ejs.renderFile(__dirname + "/views/ejs_forum.html", ejsArgs, function (err, html) {
            if (err) console.log(err);
            res.send(html);
        });
    });

});

app.get("/forum/verification", function (req, res) {
    const hash = req.query.hash;

    const sql = SQL`UPDATE forum_users_test SET email_registered = 1 WHERE verification =${hash}`;

    con.query(sql, function (err, result) {
        if (err) throw err;

        res.sendFile(__dirname + "/html/verified.html");
    })


})

app.get("/forum/account", function (req, res) {
    session = req.session;
    if (!session.username) {
        res.redirect("/forum");
        return;
    }

    ejs.renderFile(__dirname + "/views/ejs_account.html", { user: session.username }, function (err, html) {
        res.send(html);
    });
});

app.get("/forum/logout", function (req, res) {
    req.session.destroy();
    res.redirect("/forum");
});

app.get("/forum/thread", function (req, res) {
    session = req.session;
    if (!session.username) {
        res.redirect("/forum");
        return;
    }

    if (session.currThreadPage == null) { // if user is here by login, set the current page to one
        session.currThreadPage = 1;
    } else { // otherwise, set the current page to the one they just clicked on
        if (req.query.page != null) {
            session.currThreadPage = req.query.page;
        } else {
            session.currThreadPage = 1;
        }
    }

    // use hash to mask the thread id for url maybe
    const threadID = req.query.id;
    const sql = SQL`SELECT title, content, creator, date_created FROM forum_threads_test WHERE thread_id = ${threadID}`;

    con.query(sql, function (err, result) {
        if (err) console.log(err);

        if (result.length != 1) {
            // err;
        }

        const threadPoster = result[0].creator;
        const threadTitle = result[0].title;
        const threadText = result[0].content;
        var tdate = result[0].date_created
        const threadDate = tdate.toString().slice(0, 16);

        const sql = SQL`SELECT reply, forum_replies_test.thread_id, post_id, poster, reply_id, date_posted
        FROM forum_replies_test JOIN forum_threads_test ON forum_threads_test.thread_id =
        forum_replies_test.thread_id AND forum_replies_test.thread_id = ${threadID}`;
        con.query(sql, function (err, result) {
            if (err) {
                console.log(err);
            } else {
                var replyContents = [];
                var replyPosters = [];
                var replyReplies = [];
                var replyDates = [];
                var postIDs = [];
                var threadIDs = [];

                replyMap = new Map();
                userMap = new Map();


                for (var i = 0; i < result.length; i++) {
                    if (result[i].post_id < 0) {
                        i--;
                        result.shift();
                    }
                }
                var resultLength = result.length;
                var numOfPages = Math.ceil(resultLength / 10.0); // total number of viewable pages, 10 per page
                const currPage = session.currThreadPage;

                var maxIndex = currPage * 10; // max index, therefore the 10th thread of this page
                if (resultLength < maxIndex) { // if the number of threads is less than the max index, the max is set to the number of threads
                    maxIndex = resultLength;
                }

                for (var i = (currPage * 10) - 10; i < maxIndex; i++) {
                    const j = i % 10;

                    replyContents[j] = result[i].reply;
                    replyPosters[j] = result[i].poster;
                    replyReplies[j] = result[i].reply_id;

                    var date = result[i].date_posted
                    replyDates[j] = date.toString().slice(0, 16); // cuts off the timezone
                    postIDs[j] = result[i].post_id;
                    threadIDs[j] = result[i].thread_id;

                    userMap.set(postIDs[j], replyPosters[j]);
                    replyMap.set(postIDs[j], replyContents[j]);
                }

                const ejsArgs = {
                    threadTitle: threadTitle,
                    threadPoster: threadPoster,
                    threadText: threadText,
                    threadDate: threadDate,
                    threadID: threadID,
                    threadIDs: threadIDs,
                    postIDs: postIDs,
                    replyContents: replyContents,
                    replyPosters: replyPosters,
                    replyIDs: replyReplies,
                    replyDates: replyDates,
                    user: session.username,
                    replyMap: replyMap,
                    userMap: userMap,
                    altTitle: threadTitle,
                    numOfPages: numOfPages,
                    currPage: currPage
                }

                ejs.renderFile(__dirname + "/views/ejs_thread.html", ejsArgs, function (err, html) {
                    if (err) console.log(err);
                    res.send(html);
                });
            }
        })
    });
})

app.get("/404", function (req, res) {
    res.sendFile(__dirname + "/html/404.html");
})

app.get("/*", function (req, res) {
    res.sendFile(__dirname + "/html/404.html");
})

app.post("/", function (req, res) {

});

app.post("/deletereply", function (req, res) {
    const threadID = req.body.threadID;
    const replyID = req.body.replyID;
    const postID = req.body.postID;

    const sql = SQL`UPDATE forum_replies_test SET post_id = ${-postID} WHERE post_id = ${postID}`;

    con.query(sql, function (err, result) {
        if (err) throw err;

        const sql2 = SQL`UPDATE forum_replies_test SET reply_id = ${-postID} WHERE reply_id = ${postID}`;

        con.query(sql2, function (err, result) {
            if (err) throw err;
            res.redirect("/forum/thread?id=" + threadID);

        })
    })
})

app.post("/forumsignup", function (req, res) {
    session = req.session;
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    // secret does nothing?
    const hash = crypto.createHash('sha256', secret).update(password).digest('hex')
    const emailHash = crypto.createHash('sha256', secret).update(email).digest('hex')

    const date = "2021-10-04";

    var isAdmin = 0;
    var isRegistered = 1;
    var isVerified = 0;

    const emailSQL = SQL`SELECT email FROM forum_users_test WHERE email = ${email}`;
    const usernameSQL = SQL`SELECT username FROM forum_users_test WHERE username = ${username}`;
    const insert = SQL`INSERT INTO forum_users_test (username, password, email, email_registered, product_registered, is_admin, verification) VALUES (
                        ${username}, ${hash}, ${email}, ${isRegistered}, ${isVerified}, ${isAdmin}, ${emailHash})`;

    con.query(emailSQL, function (err, result) {
        if (err) throw err;

        if (!result.length == 0) {
            session.err = "email";
            req.session.save();
            res.redirect("/forum");
            return;
        }

        con.query(usernameSQL, function (err, result) {
            if (err) throw err;

            if (!result.length == 0) {
                session.err = "username";
                req.session.save();
                res.redirect("/forum");
                return;
            }

            con.query(insert, function (err, result) {
                if (err) console.log(err);
                session.err = "success";
                req.session.save();

                // const link = "http://cueteddy.herokuapp.com/forum/verification?hash=" + emailHash;
                // const text = "Please verify your email by clicking the following link: " + link;

                // var transporter = nodemailer.createTransport({
                //     service: 'gmail',
                //     auth: {
                //         user: emailUser,
                //         pass: emailPass
                //     }
                // })

                // var mailOptions = {
                //     from: emailUser,
                //     to: email,
                //     subject: "CueTeddy Forum Verification",
                //     text: text

                // }

                // transporter.sendMail(mailOptions, function (error, info) {
                //     if (error) throw error;
                //     console.log(info);
                res.redirect("/forum");

                // })


            });
        });
    })
});

app.post("/forumlogin", function (req, res) {
    session = req.session;
    const email = req.body.email;
    const password = req.body.password;

    const hash = crypto.createHash('sha256', secret).update(password).digest('hex');

    const sql = SQL`SELECT username, email, password, email_registered FROM forum_users_test WHERE email = ${email} AND password = ${hash}`;

    con.query(sql, function (err, result) {
        if (err) console.log(err);
        if (result.length == 0) {
            session.err = "login-fail";
            req.session.save();
            res.redirect("/forum");
            return;
        }

        if (result[0].email_registered == 0) {
            session.email_registered = result[0].email_registered;
            req.session.save();
            res.redirect("/forum");
            return;
        } else {
            session.username = result[0].username;
            req.session.save();
        }

        res.redirect("/forum");
    });
});

app.post("/contactus", function (req, res) {
    // var username = req.body.username;
    var name = req.body.name;
    var email = req.body.email;
    var phone = req.body.phone;
    var message = req.body.message;

    res.write("<h1>" + name + "</h1>");
    res.write("<h1>" + email + "</h1>");
    res.write("<h1>" + phone + "</h1>");
    res.write("<h1>" + message + "</h1>");

    res.end();
});

app.post("/contactcategories", function (req, res) {
    // check boxes
    var email = req.body.email;
    var message = req.body.message;

    res.write("<h1>" + email + "</h1>");
    res.write("<h1>" + message + "</h1>");

    res.end();
});


app.listen(port, function () { // this listens for the port, and essentially opens the app
    console.log("Listening on port " + port);
});

app.post("/createthread", function (req, res) {
    const title = req.body.title;
    const content = req.body.content;

    const date_ob = new Date();
    let day = ("0" + date_ob.getDate()).slice(-2);
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let year = date_ob.getFullYear();
    let hours = date_ob.getHours();
    let minutes = date_ob.getMinutes();
    let seconds = date_ob.getSeconds();

    const date = year + "-" + month + "-" + day + " " + hours + ":" + minutes + ":" + seconds;

    session = req.session;
    const sql = SQL`INSERT INTO forum_threads_test (creator, date_created, title, content) VALUES
     (${session.username}, ${date}, ${title}, ${content})`;

    con.query(sql, function (err, result) {
        if (err) {
            console.log(err)
        } else {

        }
    });

    res.redirect("/forum");
})

app.post("/createreply", function (req, res) {
    const currThread = req.body.threadID;
    const replyTo = req.body.replyID; // TODO
    const content = req.body.content;

    const date_ob = new Date();
    let day = ("0" + date_ob.getDate()).slice(-2);
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let year = date_ob.getFullYear();
    let hours = date_ob.getHours();
    let minutes = date_ob.getMinutes();
    let seconds = date_ob.getSeconds();

    const date = year + "-" + month + "-" + day + " " + hours + ":" + minutes + ":" + seconds;

    session = req.session;
    //const sql = "INSERT INTO forum_reply_test (creator_id, date_created, title, content) VALUES ('" + session.user_id + "', '" + date + "', '" + title + "', '" + content + "')";
    const sql = SQL`INSERT INTO forum_replies_test (thread_id, poster, date_posted, reply_id, reply) VALUES (
        ${currThread}, ${session.username}, ${date}, ${replyTo}, ${content})`;


    con.query(sql, function (err, result) {
        if (err) console.log(err);
    });

    res.redirect("/forum/thread?id=" + currThread);
})

app.post("/deletethread", function (req, res) {
    const threadID = req.body.threadID;
    const sql = SQL`DELETE FROM forum_threads_test WHERE thread_id =${threadID}`;

    con.query(sql, function (err, result) {
        if (err) throw err;

        res.redirect("/forum");
    })
})

app.post("/purchase", function (req, res) {
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const email = req.body.email;
    const address1 = req.body.address1;
    const address2 = req.body.address2;
    const country = req.body.country;
    const state = req.body.state;
    const zip = req.body.zip;

    const billingaddress1 = req.body.shippingAddress1;
    const billingaddress2 = req.body.shippingAddress2;
    const shppingcountry = req.body.shippingCountry;
    const billingstate = req.body.shippingState;
    const billingzip = req.body.shippingZip;

    var billing = "";

    if (billingaddress1) {
        billing = "Billing Addres: \n";
    }

    const firstNameText = "First name: " + firstName + "\n";
    const lastNameText = "Last name: " + lastName + "\n";
    const emailText = "Email: " + email + "\n";
    const address1Text = "Address1: " + address1 + "\n";
    const address2Text = "Address2: " + address2 + "\n";
    const countryText = "Country: " + country + "\n";
    const stateText = "State: " + state + "\n";
    const zipText = "Zipcode: " + zip + "\n";

    const finalText = firstNameText + lastNameText +
        emailText + address1Text + address2Text + countryText + stateText + zipText + "";

    // var transporter = nodemailer.createTransport({
    //     service: 'gmail',
    //     auth: {
    //         user: emailUser,
    //         pass: emailPass
    //     }
    // })

    // var mailOptions = {
    //     from: emailUser,
    //     to: 'cueteddydev@gmail.com',
    //     subject: "CueTeddy Purchase",
    //     text: finalText
    // }

    // transporter.sendMail(mailOptions, function (error, info) {
    //     if (error) throw error;
    //     res.sendFile(__dirname + '/html/successpurchase.html');
    // })
    res.sendFile(__dirname + '/html/successpurchase.html');


})

// CREATE TABLE`forum_users_test`(
//     `username` VARCHAR(255) NOT NULL,
//     `password` VARCHAR(255) NOT NULL,
//     `email` VARCHAR(255) NOT NULL,
//     `email_registered` BOOLEAN NOT NULL,
//     `product_registered` BOOLEAN NOT NULL,
//     `is_admin` BOOLEAN NOT NULL,
//     PRIMARY KEY(`username`)
// );

// CREATE TABLE `forum_threads_test` (
// 	`creator` VARCHAR(255) NOT NULL,
// 	`thread_id` INT NOT NULL AUTO_INCREMENT,
// 	`date_created` DATETIME NOT NULL,
// 	`title` VARCHAR(255) NOT NULL,
// 	`content` VARCHAR(255) NOT NULL,
// 	PRIMARY KEY (`thread_id`)
// );

// CREATE TABLE`forum_replies_test`(
//     `post_id` INT NOT NULL AUTO_INCREMENT,
//     `poster` VARCHAR(255) NOT NULL,
//     `thread_id` INT NOT NULL,
//     `reply_id` INT NOT NULL,
//     `date_posted` DATETIME NOT NULL,
//     `reply` VARCHAR(255) NOT NULL,
//     PRIMARY KEY(`post_id`)
// );