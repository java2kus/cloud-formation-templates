#!/usr/bin/env node
//
// Streams FlowLogs to Elasticsearch
//
var async = require('async'),
    https = require('https'),
    dns = require('dns'),
    aws4 = require('aws4'),
    zlib = require('zlib'),
    Transform = require('stream').Transform,
    es = require('event-stream'),
    geoip = require('geoip-lite');

// default record batch of 100 is
// too large to process. We chunk it.
var recordChunkSz = 15;
// event parsed counter
var eventsParsed = 0;
// the root mnemonic of the index (ES_INDEX_ROOT-YYYY.MM.DD)
var ES_INDEX_ROOT = 'flow-';
// well known hostname for ES domain
var ES_HOSTNAME = 'es-domain-a.es.test.' + process.env.AWS_DEFAULT_REGION + '.zollie.rocks';
// the AWS service endpoint set below
var ES_ENDPOINT = '';


exports.handler = function(event, context) {
    // console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
    dns.resolveCname(ES_HOSTNAME, function(err, addresses) {
        if (err) {
            console.log(err);
            return;
        }
        console.log('Looking up CNAME for host', ES_HOSTNAME);
        ES_ENDPOINT = addresses[0];
        console.log('Found CNAME', ES_ENDPOINT);
        processRecords(event, context);
    });
}

var transform = function(data, encoding, done) {
    console.log('TRANSFORMING RECORDS WITH COUNT:', data.length);

    var theTransformer = this; // gets out of scope below

    async.eachSeries(data, function(record, callback) {
            // console.log('Parsing logMessage ...');
            // console.log('logMessage', logMessage);

            async.waterfall([
                    function unpackLogMessage(next) {
                        var logMessage = new Buffer(record.kinesis.data, 'base64');
                        zlib.gunzip(logMessage, next);
                    },
                    function parseLogMessage(logMessage, next) {
                        logMessage = JSON.parse(logMessage.toString());
                        // console.log('logMessage', logMessage);

                        if (logMessage.messageType === 'CONTROL_MESSAGE') {
                            console.log('Skipping Control Message');
                            callback();
                            return;
                        }

                        // console.log('logEvents:', logMessage.logsEvents);
                        async.eachSeries(logMessage.logEvents, function(logEvent, callback2) {
                                // console.log('Parsing logEvent ...');
                                // console.log('logEvent', logEvent);

                                source = logEvent.extractedFields;
                                source['@id'] = logEvent.id;
                                source['@timestamp'] = new Date(1 * logEvent.timestamp).toISOString();
                                source['@message'] = logEvent.message;
                                source['@owner'] = logMessage.owner;
                                source['@log_group'] = logMessage.logGroup;
                                source['@log_stream'] = logMessage.logStream;

                                // src geoip
                                if (source.srcaddr) {
                                    var srcgeo = geoip.lookup(source.srcaddr);
                                    if (srcgeo) {
                                        source.srcgeo = srcgeo;
                                        source.srcgeo.point = {};
                                        source.srcgeo.point.lat = parseFloat(srcgeo.ll[0]);
                                        source.srcgeo.point.lon = parseFloat(srcgeo.ll[1]);
                                    }
                                }

                                // dst geoip
                                if (source.dstaddr) {
                                    var dstgeo = geoip.lookup(source.dstaddr);
                                    if (dstgeo) {
                                        source.dstgeo = dstgeo;
                                        source.dstgeo.point = {};
                                        source.dstgeo.point.lat = parseFloat(dstgeo.ll[0]);
                                        source.dstgeo.point.lon = parseFloat(dstgeo.ll[1]);
                                    }
                                }

                                var action = {
                                    index: {}
                                };
                                action.index._index = getIndexName(logEvent);
                                action.index._type = source['@log_group'];
                                action.index._id = source['@id'];

                                bulkRequestBody = '';
                                bulkRequestBody += [
                                    JSON.stringify(action),
                                    JSON.stringify(source)
                                ].join('\n') + '\n';

                                // console.log('pushing bulkRequestBody:', bulkRequestBody);
                                theTransformer.push(bulkRequestBody);
                                eventsParsed++;
                                callback2();
                            },
                            function(err) {
                                if (err) {
                                    // console.log('Parse of logEvents failed', err);
                                    callback(err);
                                } else {
                                    // console.log('Parse of logEvents successful');
                                    callback();
                                }
                            });
                    }
                ],
                function(err) {
                    if (err) {
                        // console.log('Parse of logMessage failed', err);
                        callback(err);
                    } else {
                        // console.log('Parse of logMessage successful');
                        callback();
                    }
                });
        },
        function(err) {
            if (err) {
                console.log('Transformation error', err);
            } else {
                console.log('Transformed all records');
            }
            done();
        });
}


function getIndexName(logEvent) {
    var timestamp = new Date(1 * logEvent.timestamp);

    // index name format: ES_INDEX_ROOT-YYYY.MM.DD
    var indexName = [
        ES_INDEX_ROOT + timestamp.getUTCFullYear(),         // year
        ('0' + (timestamp.getUTCMonth() + 1)).slice(-2),    // month
        ('0' + timestamp.getUTCDate()).slice(-2)            // day
    ].join('.');

    return indexName;
}

function processRecords(event, context) {
    console.log("RECEIVED RECORD COUNT OF:", event.Records.length);
    var recordChunks = [];
    while (event.Records.length > 0) {
        recordChunks.push(event.Records.splice(0, recordChunkSz));
    }
    console.log("CHUNKED RECORDS INTO COUNT OF:", recordChunks.length);

    async.forEachOfLimit(recordChunks, 1, function(records, key, callback) {
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

                    console.log('opts');
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
                    console.log('Successfully uploaded to ' + ES_ENDPOINT + ". Parsed " + eventsParsed + " events.");
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