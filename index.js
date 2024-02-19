// This is used for getting user input.
import { createInterface } from "readline/promises";

import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
  paginateListObjectsV2,
  GetObjectCommand,

  
} from "@aws-sdk/client-s3";


import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import csv from "csv-parser"
import AWS from 'aws-sdk';
import fs from "fs";
import path from "path";
export async function main() {
    GetCostUsage();
    //GetReport();
    //GetReportAsJson().catch(console.error);
}
import zlib from 'zlib';
import { pipeline } from 'stream';
import { promisify } from 'util';
const pipe = promisify(pipeline);
// Call a function if this file was run directly. This allows the file
// to be runnable without running on import.
import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export async function GetCostUsage(){
  const costExplorer = new CostExplorerClient({ region: "us-east-1" });

  const startDate = "2024-01-01"; // 30 days ago in YYYY-MM-DD format
  const endDate = "2024-01-31";

  const params = {
      TimePeriod:{
          Start: startDate,
          End: endDate
      },
      Granularity: 'MONTHLY',
      Metrics: ["UnblendedCost", "UsageQuantity", "UsageType"],
      Filter: {
        And: [
          {
              Dimensions: {
                  Key: 'REGION',
                  Values: ['us-east-1'] // US East (Northern Virginia)
              }
          },
          {
              Dimensions: {
                  Key: 'SERVICE',
                  Values: ['Amazon Elastic Block Store'] // Specify the AWS service
              }
          },
          {
              Dimensions: {
                  Key: 'USAGE_TYPE',
                  Values: ['EBS:VolumeUsage.gp2'] // Filter for gp2 usage type
              }
          }
      ]
      }
  };
  const command = new GetCostAndUsageCommand(params);
  try {
    const data = await costExplorer.send(command);
    console.log("Cost and Usage Data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.log("Error", err);
  }
}

export async function GetReport(){
  const bucket_name = 'nuvocodescostbucket';
  const report_prefix = 'costexport';
  const __dirname = "C:\\Workspace\\nodegetstarted";
  const s3 = new AWS.S3();
  s3.listObjectsV2({Bucket: bucket_name, Prefix: report_prefix}, (err, data) => {
    if (err) {
        console.log("Error", err);
    } else {
        if (data.Contents.length) {
            // Sort the files by LastModified date and select the most recent
            const latestReport = data.Contents.sort((a, b) => b.LastModified - a.LastModified)[0];

            const downloadParams = {
                Bucket: bucket_name,
                Key: latestReport.Key
            };

            // Define the download path and file name
            const gzipFilePath = path.join(__dirname, 'latestReport.gz');
            const csvFilePath = path.join(__dirname, 'latestReport.csv'); // The path where you want to save the decompressed CSV

            // Create a file stream
            const fileStream = fs.createWriteStream(gzipFilePath);

            // Download the latest report file
            const s3Stream = s3.getObject(downloadParams).createReadStream();
            
            // Pipe the S3 stream to the file stream
            s3Stream.pipe(fileStream).on('error', (err) => {
                console.error('File Stream:', err);
            }).on('close', () => {
                console.log(`Downloaded '${latestReport.Key}' from S3 bucket '${bucket_name}' to '${gzipFilePath}'`);
                decompressGzip(gzipFilePath, csvFilePath).catch(console.error);
            });
        } else {
            console.log("No report files found.");
        }
        
    }
  })};

  async function GetReportAsJson() {
    // Your existing S3 list and download logic here...
    const __dirname = "C:\\Workspace\\nodegetstarted";
    // Once the CSV file is ready, parse it and convert to JSON
    const csvFilePath = path.join(__dirname, 'latestReport.csv'); // Path to your CSV file
    const results = []; // Array to hold the parsed data

    fs.createReadStream(csvFilePath)
        .pipe(csv()) // Use the csv-parser to transform the CSV data
        .on('data', (data) => results.push(data)) // Push each row of data into the results array
        .on('end', () => {
            // All data has been processed, results array is now full

            // Convert the results array to a JSON string if necessary
            const json = JSON.stringify(results, null, 2); // Convert to JSON with pretty print

            // Optionally, you might want to save this JSON to a file or use it directly in your application
            console.log(json); // For demonstration, we're just logging the JSON

            // If you want to save the JSON to a file:
            const jsonFilePath = path.join(__dirname, 'latestReport.json');
            fs.writeFileSync(jsonFilePath, json, 'utf8');
            console.log(`JSON data saved to '${jsonFilePath}'`);
        });
}

  export async function decompressGzip(gzipFilePath, destinationPath) {
    const gzip = fs.createReadStream(gzipFilePath);
    const decompressed = fs.createWriteStream(destinationPath);
    await pipe(
      gzip,
      zlib.createGunzip(),
      decompressed
    );
  
    console.log(`File decompressed to ${destinationPath}`);
  }