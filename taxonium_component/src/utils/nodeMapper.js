/*
TODO:
*/

async function processJsonLines(url, sampleID) {
  // Fetch the gzipped JSONL file
  //const startTime = new Date(); // Start timing
  const response = await fetch(url);

  // Ensure the fetch was successful
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Stream the response through decompression and decoding
  const decompressedStream = response.body.pipeThrough(
    new DecompressionStream("gzip")
  );
  const textStream = decompressedStream.pipeThrough(new TextDecoderStream());

  // Reader to read the stream line by line
  const reader = textStream.getReader();
  let remainder = "";
  let result;
  let nodes = {};
  let foundSample = false; //we will be looking for a specific ID when we construct
  let foundSampleID = "";
  let foundParentID = "";
  let foundSNPCount = 0;
  let isBranch = false;
  while (!(result = await reader.read()).done) {
    const chunk = remainder + result.value;
    const lines = chunk.split("\n");
    remainder = lines.pop(); // Save the last line in case it's incomplete
    for (const line of lines) {
      if (line) {
        var snpCount = 0;
        try {
          const json = JSON.parse(line);
          if (json.config) {
            //if line has the config file, skip it to avoid an error
            continue; //this first line also has mutations dictionary for decoding, if we need that later
          }
          for (const mut of json.mutations) {
            if (mut > 107435) {
              snpCount += 1;
            }
          }
          if (json.name === sampleID) {
            //check if this is the sample we will be searching for
            foundSample = true; //if it is, we have found it
            foundSampleID = json.node_id; //store its ID so we can use it later
            foundParentID = json.parent_id; //need to get parent ID of first node as a jumping off point for internal nodes, since theyre not being stored
            foundSNPCount = snpCount;
            if (json.name.includes("node_")) {
              isBranch = true;
            }
            //console.log(json)
          }

          if (json.name.includes("node_")) {
            // Check if the node is internal
            var encodedChild = String(json.node_id) + "=" + String(snpCount); //encode child and snp count without further nesting, as trying to store them as separate objects causes Stringify error due to excessive nesting
            if (!nodes[json.node_id]) {
              //if internal, but not added to list
              nodes[json.node_id] = {
                //create new node
                parent_id: json.parent_id,
                snpCount: snpCount,
                children: [],
              };
              if (!nodes[nodes[json.node_id].parent_id]) {
                //if the parent is not yet added to the list,
                nodes[nodes[json.node_id].parent_id] = {
                  // add it to the list, with null name and parent, since we wont have that info until we read in parent node
                  parent_id: null,
                  snpCount: null,
                  children: [encodedChild], //store the node ID and the number of mutations
                };
              } else {
                nodes[nodes[json.node_id].parent_id].children.push(
                  encodedChild
                ); // if the parent node has been added, add this node to its children
              }
            }
            if (
              nodes[json.node_id] &&
              (nodes[json.node_id].parent_id === null ||
                nodes[json.node_id].name === null)
            ) {
              //if we have added this parent node previously, but finally come across in JSON
              //console.log("Node ID being updated:"+json.name)
              nodes[json.node_id].parent_id = json.parent_id; //fill in the parent ID
              nodes[json.node_id].snpCount = snpCount; //fill in the snp count
              if (!nodes[nodes[json.node_id].parent_id]) {
                //if this node, which was added by a previous step and therefore does not flag new internal step above, has a parent that has not been added to the list
                nodes[nodes[json.node_id].parent_id] = {
                  // so add it
                  parent_id: null,
                  snpCount: null,
                  children: [encodedChild], //store the node ID and the number of mutations
                };
              } else {
                nodes[nodes[json.node_id].parent_id].children.push(
                  encodedChild
                ); // if the parent node has been added, add this node to its children
              }
            }
          } else {
            // if doesnt contain "node_", then its a leaf node
            encodedChild =
              String(json.name) +
              "=" +
              String(snpCount) +
              "=" +
              String(json.meta_pangolin_lineage) +
              "=" +
              String(json.meta_genbank_accession); //encode child and snp count without further nesting, as trying to store them as separate objects causes Stringify error due to excessive nesting
            if (!nodes[json.parent_id]) {
              //we dont track leaf nodes, so if parent node is not in list, add it
              nodes[json.parent_id] = {
                //add line which fills in these null values when we read in the parent node
                parent_id: null,
                snpCount: null,
                children: [encodedChild],
              };
            } else {
              nodes[json.parent_id].children.push(encodedChild); //if parent node is in list, add this node to its children
            }
          }
        } catch (e) {
          console.error("Error parsing JSON:", e);
          return "Error parsing JSON";
        }
      }
    }
  }

  var answersArray = [
    nodes,
    foundSample,
    foundSampleID,
    foundParentID,
    foundSNPCount,
    isBranch,
  ];
  return answersArray;
}
/*
processJsonLines('https://cov2tree.nyc3.cdn.digitaloceanspaces.com/latest_public.jsonl.gz', "node_3").then(result => {
    let sliced = Object.fromEntries(Object.entries(result[0][0]).slice(0,3))//get first 3 entries
    console.log("First 3 entries: ",sliced)
    //saveObjectToJson(result[0], 'C:/Users/david/my-app/src/InternalNodeMap.json');
})
.catch(error => {
    console.error("Error processing samples:", error);
});
function saveObjectToJson(dataObject, outputPath) {
    const fs = require('fs');
    const JSONStream = require('JSONStream');
    return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(outputPath);
        const stringifyStream = JSONStream.stringifyObject();
        stringifyStream.pipe(writeStream);

        writeStream.on('finish', () => {
            console.log('JSON file has been written successfully.');
            resolve();
        });

        writeStream.on('error', (error) => {
            console.error('Stream write error:', error);
            reject(error);
        });

        stringifyStream.on('error', (error) => {
            console.error('JSON stringify error:', error);
            reject(error);
        });

        for (const key in dataObject) {
            stringifyStream.write([key, dataObject[key]]);
        }
        stringifyStream.end();
    });
}
*/
export default processJsonLines;

// Usage example
//at ~2gb of ram, 4.2ghz with 6 cores, a little under 60sec when reading from url
//time to write to file is more extensive, but ideally not a factor if its happening in the backend
//time to query backend for single node: ~0.6s
//time to add snp dist when reading is negligible
