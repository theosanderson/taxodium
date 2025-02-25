var express = require("express");
var cors = require("cors");
var compression = require("compression");
var queue = require("express-queue");
var app = express();
var fs = require("fs");
const path = require("node:path");
const os = require("node:os");
var https = require("https");
var xml2js = require("xml2js");
var axios = require("axios");
var pako = require("pako");
const URL = require("url").URL;
const ReadableWebToNodeStream = require("readable-web-to-node-stream");
const { execSync } = require("child_process");
const { Readable } = require("stream");
var parser = require("stream-json").parser;
var streamValues = require("stream-json/streamers/StreamValues").streamValues;

var importing;
var filtering;
var exporting;

const { program } = require("commander");

program
  .option("--ssl", "use ssl")
  .option("--port <port>", "port", 8000)
  .option("--config_json <config_json>", "config json")
  .option("--config_override <json>", "arbitrary JSON to override config keys")
  .option("--data_url <data url>", "data url")
  .option(
    "--data_file <data file>",
    "local data file, as alternative to data url"
  );

program.parse();

const command_options = program.opts();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "taxonium"));

const in_cache = new Set();

const cache_helper = {
  retrieve_from_cache: (key) => {
    console.log("retrieving ", key);
    if (!in_cache.has(key)) {
      console.log("not found");
      return undefined;
    } else {
      // get from tmpDir, parsing the JSON
      console.log("found");
      const retrieved = JSON.parse(fs.readFileSync(path.join(tmpDir, key)));

      return retrieved;
    }
  },
  store_in_cache: (key, value) => {
    console.log("caching ", key);
    // store in tmpDir, serializing the JSON
    fs.writeFileSync(path.join(tmpDir, key), JSON.stringify(value));
    in_cache.add(key);
  },
};

// Either data_url or data_file must be defined, if not display error
if (
  command_options.data_url === undefined &&
  command_options.data_file === undefined
) {
  console.log("--data_url or --data_file must be supplied");
  process.exit(1);
}

import("taxonium_data_handling/importing.js").then((imported) => {
  importing = imported.default;
  console.log("imported importing");
  console.log("importing is ", importing);
});

import("taxonium_data_handling/filtering.js").then((imported) => {
  filtering = imported.default;
  console.log("imported filtering");
});

import("taxonium_data_handling/exporting.js").then((imported) => {
  exporting = imported.default;
  console.log("imported exporting");
});

waitForTheImports = async () => {
  if (importing === undefined || filtering === undefined) {
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (importing !== undefined && filtering !== undefined) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }
};

var processedData = null;
var cached_starting_values = null;

let options;

app.use(cors());
app.use(compression());

app.use(queue({ activeLimit: 500000, queuedLimit: 500000 }));

const logStatusMessage = (status_obj) => {
  console.log("status", status_obj);
  if (process && process.send) {
    process.send(status_obj);
  }
};

app.get("/", function (req, res) {
  res.send("Hello World, Taxonium is here!");
});

app.get("/search", function (req, res) {
  const start_time = Date.now();
  console.log("/search");
  const json = req.query.json;
  const spec = JSON.parse(JSON.parse(json));
  console.log(spec);

  const minYbound =
    req.query.min_y !== undefined ? req.query.min_y : processedData.overallMinY;
  const maxYbound =
    req.query.max_y !== undefined ? req.query.max_y : processedData.overallMaxY;
  const minXbound =
    req.query.min_x !== undefined ? req.query.min_x : processedData.overallMinX;
  const maxXbound =
    req.query.max_x !== undefined ? req.query.max_x : processedData.overallMaxX;

  const forSingleSearch = {
    data: processedData.nodes,
    spec,
    min_y: minYbound,
    max_y: maxYbound,
    min_x: minXbound,
    max_x: maxXbound,
    y_positions: processedData.y_positions,
    mutations: processedData.mutations,
    node_to_mut: processedData.node_to_mut,
    xType: req.query.xType,
    cache_helper: cache_helper,
  };

  const result = filtering.singleSearch(forSingleSearch);
  res.send(result);
  console.log(
    "Found " +
      result.data.length +
      " results in " +
      (Date.now() - start_time) +
      "ms"
  );
  console.log("Result type was " + result.type);
});

let path_for_config = command_options.config_json;
let config;

// Check if config passed in a valid URL
const stringIsAValidUrl = (s) => {
  try {
    new URL(s);
    return true;
  } catch (err) {
    return false;
  }
};

if (stringIsAValidUrl(path_for_config)) {
  console.log("CONFIG_JSON detected as a URL. Downloading config.");
  // Delete any trailing /
  path_for_config = path_for_config.endsWith("/")
    ? path_for_config.slice(0, -1)
    : path_for_config;

  // Download file through wget
  execSync(`wget -c ${path_for_config}`);

  // Extract file name
  const splitURL = path_for_config.split("/");
  const fileName = splitURL[splitURL.length - 1];

  path_for_config = fileName;

  console.log("Config name set to", path_for_config);
}

// check if path exists
if (path_for_config && fs.existsSync(path_for_config)) {
  config = JSON.parse(fs.readFileSync(path_for_config));
} else {
  config = { title: "", source: "", no_file: true };
}

if (command_options.config_override) {
  try {
    // Parse the override JSON string provided on the command line.
    const overrides = JSON.parse(command_options.config_override);
    // Merge key-by-key into the base config.
    config = { ...config, ...overrides };
    console.log("Configuration after override:", config);
  } catch (err) {
    console.error("Error parsing --config_override JSON:", err);
    process.exit(1);
  }
}

app.get("/config", function (req, res) {
  config.num_nodes = processedData.nodes.length;
  config.initial_x =
    (processedData.overallMinX + processedData.overallMaxX) / 2;
  config.initial_y =
    (processedData.overallMinY + processedData.overallMaxY) / 2;
  config.initial_zoom = -2;
  config.genes = processedData.genes;
  config = { ...config, ...processedData.overwrite_config };
  config.rootMutations = config.useHydratedMutations
    ? []
    : processedData.rootMutations;
  config.rootSequences = processedData.rootSequences;
  config.rootId = processedData.rootId;

  res.send(config);
});

app.get("/mutations/", function (req, res) {
  // Set headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Function to send SSE
  function sendSSE(data) {
    res.write(`data: ${data}\n\n`);
  }

  // Send mutations in chunks of 100000
  const chunkSize = 10000;
  let index = 0;

  function sendNextChunk() {
    const chunk = processedData.mutations.slice(index, index + chunkSize);
    if (chunk.length > 0) {
      sendSSE(JSON.stringify(chunk));
      index += chunkSize;
      // Schedule the next chunk
      setImmediate(sendNextChunk);
    } else {
      // All mutations sent, end the stream
      sendSSE("END");
      res.end();
    }
  }

  // Start sending chunks
  sendNextChunk();

  // Handle client disconnect
  req.on("close", () => {
    // No need to destroy a stream, just stop the process
    index = processedData.mutations.length; // This will stop sendNextChunk on next iteration
  });
});

app.get("/nodes/", function (req, res) {
  const start_time = Date.now();
  let min_y =
    req.query.min_y !== undefined ? req.query.min_y : processedData.overallMinY;
  let max_y =
    req.query.max_y !== undefined ? req.query.max_y : processedData.overallMaxY;
  let min_x =
    req.query.min_x !== undefined ? req.query.min_x : processedData.overallMinX;
  let max_x =
    req.query.max_x !== undefined ? req.query.max_x : processedData.overallMaxX;
  if (min_y < processedData.overallMinY) {
    min_y = processedData.overallMinY;
  }
  if (max_y > processedData.overallMaxY) {
    max_y = processedData.overallMaxY;
  }
  if (min_x < processedData.overallMinX) {
    min_x = processedData.overallMinX;
  }
  if (max_x > processedData.overallMaxX) {
    max_x = processedData.overallMaxX;
  }
  let result;

  if (
    min_y === processedData.overallMinY &&
    max_y === processedData.overallMaxY &&
    min_x === processedData.overallMinX &&
    max_x === processedData.overallMaxX &&
    req.query.xType === "x_dist"
  ) {
    result = cached_starting_values;

    console.log("Using cached values");
  } else {
    result = filtering.getNodes(
      processedData.nodes,
      processedData.y_positions,
      min_y,
      max_y,
      min_x,
      max_x,
      req.query.xType,
      config.useHydratedMutations,
      processedData.mutations
    );
  }
  console.log("Ready to send after " + (Date.now() - start_time) + "ms.");

  // This will be sent as json
  res.send({ nodes: result });
  console.log(
    "Request took " +
      (Date.now() - start_time) +
      "ms, and output " +
      result.length +
      " nodes."
  );
});

function startListening() {
  if (command_options.ssl) {
    options = {
      key: fs.readFileSync(
        "/etc/letsencrypt/live/api.taxonium.org/privkey.pem"
      ),
      ca: fs.readFileSync("/etc/letsencrypt/live/api.taxonium.org/chain.pem"),
      cert: fs.readFileSync(
        "/etc/letsencrypt/live/api.taxonium.org/fullchain.pem"
      ),
    };
    https.createServer(options, app).listen(command_options.port, "0.0.0.0");
    console.log("SSL on port " + command_options.port);
  } else {
    app.listen(command_options.port, "0.0.0.0");
    console.log("Non SSL on port " + command_options.port);
  }
}

async function getGenBankAuthors(genbank_accession) {
  const genbank_xml_url =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=" +
    genbank_accession +
    "&rettype=gb&retmode=xml";
  const genbank_xml = await axios.get(genbank_xml_url);
  const genbank_xml_json = await xml2js.parseStringPromise(genbank_xml.data);

  let authors =
    genbank_xml_json["GBSet"]["GBSeq"][0]["GBSeq_references"][0][
      "GBReference"
    ][0]["GBReference_authors"][0]["GBAuthor"];
  authors = authors.map((x) => {
    const [last, first] = x.split(",");
    return first + " " + last;
  });
  return authors;

  //['GBSeq_xrefs'][0]['GBXref'])
}

app.get("/node_details/", async (req, res) => {
  const start_time = Date.now();
  const query_id = req.query.id;
  const node = processedData.nodes[query_id];
  const node_mutations = processedData.node_to_mut[query_id].map((mutation) => {
    return processedData.mutations[mutation];
  });

  const detailed_node = { ...node, mutations: node_mutations };

  if (
    config.enable_genbank_acknowledgement &&
    detailed_node.meta_genbank_accession
  ) {
    const genbank_accession = detailed_node.meta_genbank_accession;
    let authors;
    try {
      authors = await getGenBankAuthors(genbank_accession);
    } catch (e) {
      console.log("Error getting authors", e);
    }
    if (authors) {
      detailed_node.acknowledgements = { authors: authors.join(", ") };
    }
  }

  res.send(detailed_node);
  console.log(
    "Request took " + (Date.now() - start_time) + "ms, and output " + node
  );
});

app.get("/tip_atts", async (req, res) => {
  const start_time = Date.now();
  const node_id = req.query.id;
  const att = req.query.att;
  const atts = filtering.getTipAtts(processedData.nodes, node_id, att);
  res.send(atts);
  console.log(
    "Request took " + (Date.now() - start_time) + "ms, and output " + atts
  );
});

// match /nextstrain_json/12345
app.get("/nextstrain_json/:root_id", async (req, res) => {
  const root_id = parseInt(req.params.root_id);
  const json = await exporting.getNextstrainSubtreeJson(
    root_id,
    processedData.nodes,
    config,
    processedData.mutations
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; " + "filename=" + root_id + ".nextstrain.json"
  );
  res.send(json);
});

const loadData = async () => {
  await waitForTheImports();
  let supplied_object;
  if (command_options.data_file) {
    local_file = command_options.data_file;
    //  create a stream from the file
    const stream = fs.createReadStream(local_file);

    supplied_object = {
      stream: stream,
      status: "stream_supplied",
      filename: local_file,
    };
  } else {
    url = command_options.data_url;

    supplied_object = { status: "url_supplied", filename: url };
  }

  processedData = await importing.processJsonl(
    supplied_object,
    logStatusMessage,
    ReadableWebToNodeStream.ReadableWebToNodeStream,
    parser,
    streamValues
  );

  logStatusMessage({
    status: "finalising",
  });

  if (config.no_file) {
    importing.generateConfig(config, processedData);
  }

  processedData.genes = new Set(
    processedData.mutations.map((mutation) => mutation.gene)
  );
  // as array
  processedData.genes = Array.from(processedData.genes);
  console.log("Loaded data");

  result = filtering.getNodes(
    processedData.nodes,
    processedData.y_positions,
    processedData.overallMinY,
    processedData.overallMaxY,
    processedData.overallMinX,
    processedData.overallMaxX,
    "x_dist",
    config.useHydratedMutations,
    processedData.mutations
  );

  cached_starting_values = result;
  console.log("Saved cached starting vals");
  // set a timeout to start listening

  setTimeout(() => {
    console.log("Starting to listen");
    startListening();
    logStatusMessage({
      status: "loaded",
    });
  }, 10);
};
loadData();
