// Dependencies
var AWS = require('aws-sdk');
var cloudwatch = new AWS.CloudWatchLogs({apiVersion: '2014-03-28'});
var config = require('../config/paperwatch.json');

// Handler function
exports.handler = function(event, context, callback){

  // Construct consumer function arn
  var consumerArn = "arn:aws:lambda:" + event.region + ":" + event.account + ":function:" + config.consumer;
  var logGroup = event.detail.requestParameters.logGroupName;
  var groupPath = logGroup.split('/');

  if(groupPath.length < 4 || groupPath[2] != "lambda"){
    // Verify that the log group belongs to a lambda function (formatted /aws/lambda/FunctionName)
    console.info("Log group not for lambda function, no action taken");
    return callback();
  }else if(groupPath[3] == config.consumer){
    //Don't subscribe the consumer function to its own log group
    console.info("Log group is for the consumer function, no action taken");
    return callback();
  }else if(config.exclude && config.exclude.indexOf(groupPath[3]) > -1){
    //Don't add a subscription if the function is on the exclusion list
    console.info("Log group is for an excluded lambda function, no action taken");
    return callback();
  }

  var subscriptionParams = {
    logGroupName: logGroup,
    destinationArn: consumerArn,
    filterName: "Papertrail",
    filterPattern: ""
  };

  // Subscribe consumer to log group
  cloudwatch.putSubscriptionFilter(subscriptionParams, function(err, data){
    if(err){
      console.error("Unable to create subscription filter for log group ", logGroup);
      console.error(err.code, "-", err.message);
    }

    // Execute callback here, since we don't care if the putRetentionPolicy request fails or not
    return callback(err);
  });

  if(config.retentionPeriod){
    var retentionParams = {
      logGroupName: logGroup,
      retentionInDays: config.retentionPeriod
    };

    // Set log group's retention policy to 3 days
    cloudwatch.putRetentionPolicy(retentionParams, function(err, data){
      if(err){
        console.warn("Unable to update log group retention policy");
        console.warn(err.code, "-", err.message);
      }
    });
  }
};
