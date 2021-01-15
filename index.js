require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const shortid = require("shortid");
const dns = require("dns");
const mongodb = require("mongodb");
const MongoClient = mongodb.MongoClient;
const cors = require("cors");
const valid_url = require("valid-url");
var jwt = require("jsonwebtoken")

const app = express();
const url =
  "mongodb+srv://srikanth:srikanth@11@short.m1jiw.mongodb.net/short?retryWrites=true&w=majority";
const dbName = "short";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  cors({
    origin: "https://sri-ur1shortner.netlify.app",
  })
);

function authenticate(req, res, next) {
  if (req.headers.authorization) {

      jwt.verify(req.headers.authorization, process.env.JWT_TOKEN, function (err, data) {
          if (data) {
              if (data.userid) {
                  req.body.userid = data.userid
                  req.body.email = data.email
                  next()
              } else {
                  res.status(401).json({
                      message: "Not Authorized"
                  })
              }

          } else {
              res.status(400).json({
                  message: "Invalid Token"
              })
          }
      })
  } else {
      res.status(400).json({
          messsage: "No Token Present"
      })
  }
}


app.post("/shorten-url", authenticate,async (req, res) => {
  console.log(req.body);

  //create connection for client
  let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
  try {
    // check if it is in valid url format
    if (valid_url.isUri(req.body.url)) {
      let url = new URL(req.body.url);

      //check if domain name exists
      dns.lookup(url.hostname, { all: true }, async (error, results) => {
        if (error) {
          res.status(400).json({
            message: "Domain Does not exists",
          });
        } else {
          //shorten and insert the url in db
          let url = req.body.url;
          let email = req.body.email
          let db = connection.db(dbName);
          let urlData = await db.collection("url").findOne({
            $and: [{ url: url }, { email: email }]
        });
          if (urlData) {
            res.json({
              message: "Shortern Url Already Exists",
              data: urlData,
            });
          } else {
            let shortUrl = shortid.generate();
            let urlData = {
              email:req.body.email,
              url,
              shortUrl,
              clicks: 0,
            };
            await db.collection("url").insertOne(urlData);
            res.json({
              message: "Short url generated Successfully",
              data: urlData,
            });
          }
          await connection.close();
        }
      });
    } else {
      res.status(400).json({
        message: "Please enter a valid Url",
      });
    }
  } catch (err) {
    console.log(err);
    res.status(401).json({
      message: "Some Error Occured",
      data: err,
    });
  }
});

app.get("/redirect-url/:shortUrl", async (req, res) => {
  //create connection for client
  let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
  try {
    //check url exists
    let db = connection.db(dbName);
    let urlData = await db
      .collection("url")
      .findOne({ shortUrl: req.params.shortUrl });
    if (urlData) {
      //update click count in db
      await db
        .collection("url")
        .updateOne(
          { _id: urlData._id },
          { $set: { clicks: ++urlData.clicks } }
        );
      res.json({
        message: "SuccessFully fetched Redirect Data",
        data: urlData,
      });
    } else {
      res.status(400).json({
        message: "Invalid short url",
      });
    }
  } catch (err) {
    res.status(401).json({
      message: "Some Error Occured",
      data: err,
    });
  } finally {
    connection.close();
  }
});

// get all url details for the user
app.get("/url-data",authenticate, async (req, res) => {
  //create connection
  let connection = await MongoClient.connect(url, { useUnifiedTopology: true });
  try {
    // fetch all the url details
    let db = connection.db(dbName);
    let urlData = await db.collection("url").find().toArray();
    res.json({
      message: "Url details fetched successfully",
      data: urlData,
    });
  } catch (err) {
    res.status(401).json({
      message: "Some Error Occured",
      data: err,
    });
  } finally {
    connection.close();
  }
});

//listen on port
app.listen(process.env.PORT || 3000);
