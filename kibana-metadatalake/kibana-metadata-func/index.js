#!/usr/bin/env node
//
// Streams DynamoDB updates to Elasticsearch
//
var _ = require('lodash'),
    async = require('async'),
    https = require('https'),
    dns = require('dns'),
    aws4 = require('aws4'),
    Transform = require('stream').Transform,
    es = require('event-stream'),
    geoip = require('geoip-lite'),
    attr = require('dynamodb-data-types').AttributeValue;


// default record batch of 100 is
// too large to process. We chunk it.
var recordChunkSz = 10;
// event parsed counter
var eventsParsed = 0;
// the root mnemonic of the index (ES_INDEX_ROOT-YYYY.MM.DD)
var ES_INDEX_ROOT = ''; // set below to kebab of DYNAMO_DB_TABLE_NAME
// the index type
var ES_INDEX_TYPE = 'files';
// well known hostname for ES domain
var ES_HOSTNAME = 'es-domain-a.es.test.' + process.env.AWS_DEFAULT_REGION + '.zollie.rocks';
// the AWS service endpoint set below
var ES_ENDPOINT = '';
// stream table name determined from streamArn
var DYNAMO_DB_TABLE_NAME = '';

exports.handler = function(event, context) {
    // console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
    async.series([
        function resolveDomainCNAME(callback) {
            dns.resolveCname(ES_HOSTNAME, function(err, addresses) {
                console.log('Looking up CNAME for host', ES_HOSTNAME);
                if (err) {
                    callback(err);
                } else {
                    ES_ENDPOINT = addresses[0];
                    console.log('Found CNAME', ES_ENDPOINT);
                    callback();
                }
            });
        },
        function determineDynamoDBTableName(callback) {
            DYNAMO_DB_TABLE_NAME = getTableName(event.Records[0].eventSourceARN);
            console.log('DYNAMO_DB_TABLE_NAME', DYNAMO_DB_TABLE_NAME);
            ES_INDEX_ROOT = _.kebabCase(DYNAMO_DB_TABLE_NAME);
            console.log('ES_INDEX_ROOT', ES_INDEX_ROOT);
            callback();
        }
    ], function(err) {
        if (err) {
            console.log(err);
            context.fail();
        } else {
            processRecords(event, context);
        }
    });
}

var transform = function(data, encoding, done) {
    console.log('TRANSFORMING RECORDS WITH COUNT:', data.length);

    theTransformer = this; // gets out of scope below

    async.eachSeries(data, function(record, callback) {
            var action = {};
            var doc = {};

            switch (record.eventName) {
                case 'INSERT':
                    // turn into Plain Old JSON and index
                    doc = attr.unwrap(record.dynamodb.NewImage);
                    doc['@id'] = doc.FilePath;
                    action.index = {};
                    action.index._index = getIndexName(doc);
                    action.index._type = ES_INDEX_TYPE;
                    doc['@timestamp'] = new Date(doc.LastModTime).toISOString();
                    action.index._id = doc['@id'];

                    // client_ip geoip
                    // console.log('SourceIp:', doc.SourceIp);
                    var sourcegeo = geoip.lookup(doc.SourceIp);
                    console.log('sourcegeo:', sourcegeo);

                    doc.sourcegeo = sourcegeo ||  {
                        range: [0,0],
                        country: 'US',
                        region: process.env.AWS_DEFAULT_REGION,
                        city: 'AWS',
                        ll: [0,0],
                        metro: 0
                    };
                    doc.sourcegeo.point = {};
                    doc.sourcegeo.point.lat = parseFloat(doc.sourcegeo.ll[0]);
                    doc.sourcegeo.point.lon = parseFloat(doc.sourcegeo.ll[1]);
                    break;

                case 'REMOVE':
                    // turn into Plain Old JSON and delete
                    doc = attr.unwrap(record.dynamodb.OldImage);
                    doc['@id'] = doc.FilePath;
                    action.delete = {};
                    action.delete._index = getIndexName(doc);
                    action.delete._type = ES_INDEX_TYPE;
                    action.delete._id = doc['@id'];
                    break;

                default:
                    console.log('Unrecognized eventName:', record.eventName)
                    callback();
                    return;
            }

            bulkRequestBody = '';
            bulkRequestBody += [
                JSON.stringify(action),
                JSON.stringify(doc),
            ].join('\n') + '\n';

            theTransformer.push(bulkRequestBody);
            eventsParsed++;
            callback();
        },
        function(err) {
            if (err) {
                console.log('Transformation error', err);
                done(); // passed err will be uncaught
            } else {
                console.log('Transformed all records');
                done();
            }
        });
}


function getIndexName(doc) {
    // console.log('Getting indexName', doc);
    var timestamp = new Date(doc.LastModTime);
    // index name format: ES_INDEX_ROOT-YYYY.MM.DD
    var indexName = [
        ES_INDEX_ROOT + '-' + timestamp.getUTCFullYear(),   // year
        ('0' + (timestamp.getUTCMonth() + 1)).slice(-2),    // month
        ('0' + timestamp.getUTCDate()).slice(-2)            // day
    ].join('.');

    return indexName;
}

function getTableName(streamArn) {
    console.log('streamArn', streamArn)
    return streamArn.split('/')[1];
}

function processRecords(event, context) {
    console.log("RECEIVED RECORD COUNT OF:", event.Records.length);
    var recordChunks = [];
    while (event.Records.length > 0) {
        recordChunks.push(event.Records.splice(0, recordChunkSz));
    }
    console.log("CHUNKED RECORDS INTO COUNT OF:", recordChunks.length);

    async.forEachOfSeries(recordChunks, function(records, key, callback) {
        async.waterfall([
                function getRecords(next) {
                    console.log("Getting Kinesis Records for CHUNK:", key);

                    var parser = new Transform({
                        objectMode: true
                    })

                    parser._transform = transform;

                    var bufferStream = new Transform({
                        objectMode: true
                    });

                    bufferStream.push(records)
                    bufferStream.end();
                    // transform
                    bufferStream
                        .pipe(parser)
                        .pipe(es.wait(next));
                },
                function upload(data, next) {
                    // Stream the logfile to Elasticsearch.
                    // console.log('Using Elasticsearch endpoint:', ES_ENDPOINT);
                    // console.log('Using bulk data:', data);

                    var opts = {
                        host: ES_ENDPOINT,
                        path: '/_bulk',
                        method: 'POST',
                        body: data,
                        headers: {
                            'Content-Type': 'application/x-amz-json-1.1'
                        }
                    };

                    aws4.sign(opts);

                    var httpCallback = function(response) {
                        var str = '';

                        // another chunk of data has been recieved, so append it to `str`
                        response.on('data', function(chunk) {
                            // console.log(chunk);
                            str += chunk;
                        });

                        // the whole response has been recieved, so we just print it out here
                        response.on('end', function() {
                            // console.log(str);
                            next(null, str);
                        });

                        // error recieved
                        response.on('error', function(err) {
                            console.log(err);
                            next(err, null);
                        });
                    }

                    https.request(opts, httpCallback).end(data);
                }
            ],
            function(err, data) {
                if (err) {
                    console.log(err);
                    callback(err);
                } else {
                    console.log('Successfully uploaded to ' + ES_ENDPOINT
                        + ". Parsed " + eventsParsed + " events.");
                    callback();
                }

            });
    }, function(err) {
        if (err) {
            console.log('Chunk error', err);
        } else {
            console.log('Chunked all records');
        }
        context.done();
    });
}