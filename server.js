var express = require('express'),
    handlebars = require('express-handlebars'),
    busboy = require('connect-busboy'),
    streamToBuffer = require('stream-to-buffer'),
    brotli = require('brotli'),
    fs = require('fs')

var mongo = require('mongodb'),
    MongoClient = mongo.MongoClient,
    ObjectID = mongo.ObjectID

var app = express()

// Initialize .env for virtual enviroment (local testing)
require('dotenv').config()

var url = process.env.MONGO_URI
// var url = "mongodb://test:password@127.0.0.1:27017/flan"
var allowedMimeTypes = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']

app.use(express.static('public'))

app.use(busboy())

app.engine('handlebars', handlebars({
    defaultLayout: 'default'
}))
app.set('view engine', 'handlebars')

app.get('/', function(req, res) {
    MongoClient.connect(url, function(err, db) {
            if (err) {
                // @TODO: Render error in page
                console.error("Unable to connect to MongoDB: ", err)
            } else {
                db.collection('images').find().sort({
                    created: -1
                }).limit(20).toArray(function(err, images) {
                        if (err) {
                            console.error("Error searching DB:", err)
                            res.render('index', {
                                endpoint: "home",
                                error: "Database error"
                            })
                        } else {
                            if (images.length > 0) {
                                images.map(function(image) {
                                    image.data = new Buffer(brotli.decompress(image.data.buffer, image.length)).toString('base64')
                                })
                                res.render('index', {
                                    endpoint: "home",
                                    images: JSON.parse(JSON.stringify(images))
                                })
                            } else {
                                res.render('index', {
                                    endpoint: "home",
                                    error: "No new posts at the moment! :("
                                })
                            }
                    }
                })
        }
    })
})

app.get('/upload', function(req, res) {
    res.render('upload', {
        endpoint: 'upload'
    })
})

app.post('/upload', function(req, res) {
    if (req.busboy) {
        var metadata = {
            created: new Date().getTime()
        }

        req.busboy.on('field', function(name, value) {
            switch (name) {
                case 'title':
                    metadata.title = value
                    break
                case 'tags':
                    metadata.tags = value.split(',')
                    metadata.tags.map(function(tag) {
                        tag = tag.trim()
                    })
                    break
                default:
                    break
            }
        })

        req.busboy.on('file', function(name, file, filename, encoding, mimeType) {
            if ((function(mime) {
                    for (var i = 0; i < allowedMimeTypes.length; i++)
                        if (allowedMimeTypes[i] == mime) return true
                })(mimeType)) {
                metadata.mimeType = mimeType
                streamToBuffer(file, function(err, buffer) {
                    if (err) {
                        res.render('upload', {
                            endpoint: "upload",
                            error: "There was an error uploading your image."
                        })
                        console.error("Error converting ReadStream to a Buffer")
                    } else {
                        metadata.length = buffer.length
                        metadata.data = new Buffer(brotli.compress(buffer))
                    }
                })
            } else {
                // @TODO: error - MimeType not allowed
                console.error("MimeType not allowed:", mimeType)
                res.render('upload', {
                    endpoint: "upload",
                    error: "MimeType not allowed."
                })
            }
        })

        req.busboy.on('finish', function() {
            MongoClient.connect(url, function(err, db) {
                if (err) {
                    res.render('upload', {
                        endpoint: "upload",
                        error: "There was an error uploading your image."
                    })
                    console.error("Unable to connect to MongoDB: ", err)
                } else {
                    db.collection('images').insertOne(metadata, function(err, result) {
                        if (err) {
                            res.render('upload', {
                                endpoint: "upload",
                                error: "There was an error uploading your image."
                            })
                            console.error("Error when inserting document into collection: ", err)
                        } else {
                            res.redirect('/view/' + result.insertedId.toString())
                        }

                        db.close()
                    })
                }
            })
        })
        req.pipe(req.busboy)
    } else {
        console.error("No busboy object in request object")
        res.render('uplaod', {
            endpoint: "upload",
            error: "There was an error uploading your image."
        })
    }
})

app.get('/view', function(req, res) {
    res.render('view', {
        endpoint: 'view',
        error: 'Must supply an imageID, in the form: `/view/:id`'
    })
})

app.get('/view/:id', function(req, res) {
    MongoClient.connect(url, function(err, db) {
        if (err) {
            res.render('view', {
                endpoint: "view",
                error: "There was an error loading your image."
            })
            console.error("Unable to connect to MongoDB: ", err)
        } else {
            db.collection('images').findOne({
                _id: new ObjectID(req.params.id)
            }, function(err, result) {
                if (err) {
                    res.render('view', {
                        endpoint: "view",
                        error: "There was an error loading your image."
                    })
                    console.error("Error searching DB:", err)
                } else {
                    result.data = new Buffer(brotli.decompress(result.data.buffer, result.length)).toString('base64')
                    res.render('view', {
                        endpoint: 'view',
                        img: result
                    })
                }
                db.close()
            })
        }
    })
})

app.get('/search', function(req, res) {
    if (req.query.q) {
        MongoClient.connect(url, function(err, db) {
            if (err) {
                res.render('search', {
                    endpoint: "search",
                    error: "There was an error performing search"
                })
                console.error("Unable to connect to MongoDB: ", err)
            } else {
                db.collection('images').find({
                    tags: {
                        "$in": req.query.q.replace('#', '').split(',')
                    }
                }).sort({
                    created: -1
                }).toArray(function(err, images) {
                    if (err) {
                        res.render('search', {
                            endpoint: "search",
                            error: "There was an error performing search"
                        })
                        console.error("Error searching DB:", err)
                    } else {
                        images.map(function(image) {
                            image.data = new Buffer(brotli.decompress(image.data.buffer, image.length)).toString('base64')
                        })
                        res.render('search', {
                            endpoint: "search",
                            images: JSON.parse(JSON.stringify(images))
                        })
                    }
                })
            }
        })
    } else {
        res.render('search', {
            endpoint: 'search',
            error: ''
        })
    }
})

app.get('/img/:id', function(req, res) {
    MongoClient.connect(url, function(err, db) {
        if (err) {
            res.send("Error loading image")
            console.error("Unable to connect to MongoDB: ", err)
        } else {
            db.collection('images').findOne({
                _id: new ObjectID(req.params.id)
            }, function(err, result) {
                if (err) {
                    res.send("Error loading image")
                    console.error("Error searching DB:", err)
                } else {
                    /*res.render('view', {
                        data: "data:" + result.mimeType + ";base64," + new Buffer(brotli.decompress(new Buffer(result.data))).('base64')
                    })*/
                    res.writeHead(200, {
                        'Content-Type': result.mimeType
                    })
                    res.end(new Buffer(brotli.decompress(result.data.buffer, result.length)).toString('base64'), 'base64')
                }
                db.close()
            })
        }
    })
})

app.get('/api/v1/img/:id', function(req, res) {
    MongoClient.connect(url, function(err, db) {
        if (err) {
            res.json({
                success: false,
                error: {
                    message: "Error loading image"
                }
            })
            console.error("Unable to connect to MongoDB: ", err)
        } else {
            db.collection('images').findOne({
                _id: new ObjectID(req.params.id)
            }, function(err, result) {
                if (err) {
                    res.json({
                        success: false,
                        error: {
                            message: "Error loading image"
                        }
                    })
                    console.error("Error searching DB:", err)
                } else {
                    result.data = new Buffer(brotli.decompress(result.data.buffer, result.length)).toString('base64')
                    res.json(result)
                }
                db.close()
            })
        }
    })
})

app.get('/api/v1/search/tag/:tag', function(req, res) {

})

var server = app.listen(process.env.PORT || 5000, function() {
    console.log("Listening on port: %d", server.address().port)
})
