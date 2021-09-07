import "./App.css";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import Deck from "./Deck";
import SearchPanel from "./components/SearchPanel";
import axios from "axios";
import pako from "pako";

//import {FaGithub} from  "react-icons/fa";


var protobuf = require("protobufjs");




protobuf.parse.defaults.keepCase = true;

const searchColors = [
  [255, 0, 0],
  [183, 0, 255],
  [255, 213, 0],

  [0, 0, 255],
  [0, 255, 255],
];



function Taxodium({protoUrl,uploadedData, query,setQuery}) {
  const [zoomToSearch, setZoomToSearchOrig] = useState({ index: null });
  const setZoomToSearch = useCallback( (info) => {
    let newQuery = {...query}
    delete newQuery.zoomToSearch
    setQuery(newQuery);
    setZoomToSearchOrig(info);
  }
  , [setZoomToSearchOrig,query,setQuery]);
  const [showMutText, setShowMutText] = useState(false);

  const searchItems = useMemo(() => JSON.parse(query.search), [query.search]);

  const setSearchItems = useCallback(
    (search) => {
      setQuery({ ...query, search: JSON.stringify(search) });
    },
    [setQuery, query]
  );

  const setColourBy = useCallback(
    (colourBy) => {
      setQuery({ ...query, colourBy: JSON.stringify(colourBy) });
    },
    [setQuery, query]
  );
  const colourBy = useMemo(() => JSON.parse(query.colourBy), [query.colourBy]);

  const setColourByWithCheck = useCallback(
    (x) => {
      setColourBy(x);
    },
    [setColourBy]
  );
  const [nodeData, setNodeData] = useState({
    status: "not_attempted",
    data: { node_data: { ids: [] } },
  });

  const [selectedNode, setSelectedNode] = useState(null);


function getRawfile(protoUrl, uploadedData) {
  if(uploadedData){
    return new Promise((resolve, reject) => {resolve(uploadedData)} )
      }    else{
        console.log("aaaa",protoUrl)

  return axios.get(protoUrl, {
            responseType: "arraybuffer",
            onDownloadProgress: (progressEvent) => {
              let percentCompleted = Math.floor(
                1 * (progressEvent.loaded / 100000000) * 100
              );
              setNodeData({
                status: "loading",
                progress: percentCompleted,
                data: { node_data: { ids: [] } },
              });
            },
          })
          .then(function (response) {
            if(protoUrl.endsWith(".gz")){
              return pako.ungzip(response.data);
            }
            else{
              return response.data;
            
          }})
        }
      }

  useEffect(() => {
    if (nodeData.status === "not_attempted") {
      console.log("starting dl");
      setNodeData({
        status: "loading",
        progress: 0,
        data: { node_data: { ids: [] } },
      });

      protobuf.load("./taxodium.proto").then(function (root) {
        getRawfile(query.protoUrl,uploadedData).then(function (buffer) {
            console.log("buffer loaded");
            var NodeList = root.lookupType("AllData");

            var message = NodeList.decode(new Uint8Array(buffer));
            var result = NodeList.toObject(message);
            if(result.node_data.metadata_singles){

              const country_data = result.node_data.metadata_singles.filter(x=>x.metadata_name==="Country")[0]
              result.country_mapping=country_data.mapping
              result.node_data.countries = country_data.node_values

              const lineage_data = result.node_data.metadata_singles.filter(x=>x.metadata_name==="Lineage")[0]
              result.lineage_mapping=lineage_data.mapping
              result.node_data.lineages = lineage_data.node_values

            }


            result.node_data.ids = [...Array(result.node_data.x.length).keys()];

            const all_genes = new Set();
            result.mutation_mapping = result.mutation_mapping.map((x, i) => {
              const mutation_array = {};

              const [gene, rest] = x.split(":");
              if (rest) {
                const [orig_res, position, final_res] = rest.split("_");
                mutation_array.gene = gene;
                mutation_array.position = position;
                mutation_array.orig_res = orig_res;
                mutation_array.final_res = final_res;
                all_genes.add(gene);
              }
              mutation_array.id = i;
              return mutation_array;
            });

            result.all_genes = Array.from(all_genes).sort();
            setNodeData({ status: "loaded", data: result });
          });
      });
    }
  }, [nodeData.status, query.protoUrl, uploadedData]);

  const data = useMemo(
    () =>
      nodeData.status === "loaded" ? nodeData.data : { node_data: { ids: [] } },
    [nodeData]
  );

  const scatterIds = useMemo(
    () => data.node_data.ids.filter((x) => data.node_data.names[x] !== ""),
    [data]
  );

  const [search_configs_initial, numSearchResults, totalSeqs] = useMemo(() => {
    const configs = searchItems.map((item, counter) => {
    
      let filter_function;
      const lowercase_query = item.value.toLowerCase().trim();
      if (item.category === "mutation") {
        
        const subset = data.mutation_mapping
          ? data.mutation_mapping
              .filter(
                (x) =>
                  x.gene === item.aa_gene &&
                  x.position === item.aa_pos &&
                  (x.final_res === item.aa_final) | (item.aa_final === "any")
              )
              .map((x) => x.id)
          : [];

        filter_function = (x) =>
          data.node_data.mutations[x] &&
          data.node_data.mutations[x].mutation &&
          subset.filter((i) => data.node_data.mutations[x].mutation.includes(i))
            .length > 0 &&
          data.node_data.num_tips[x] >= item.min_tips &&
          data.node_data.parents[x] !== x;
      }

      if (item.category === "name") {
        filter_function = (x) =>
          data.node_data.names[x].toLowerCase().includes(lowercase_query); //TODO precompute lowercase mapping for perf?
      }

      if (item.category === "country") {
        filter_function = (x) =>
          data.country_mapping[data.node_data.countries[x]].toLowerCase() ===
          lowercase_query; //TODO precompute lowercase mapping for perf
      }
      if (item.category === "lineage") {
        filter_function = (x) =>
          data.lineage_mapping[data.node_data.lineages[x]].toLowerCase() ===
          lowercase_query; //TODO precompute lowercase mapping for perf
      }

      if (item.category === "epis") {
        if (!item.search_for_ids) {
          filter_function = (x) => false;
        } else {
          const the_list = item.search_for_ids
            .split("\n")
            .map((x) => parseInt(x.trim().replace("EPI_ISL_", "")))
            .filter((x) => x !== 0);

          filter_function = (x) =>
            the_list.includes(data.node_data.epi_isl_numbers[x]);
        }
      }

      if (item.category === "genbanks") {
        if (!item.search_for_ids) {
          filter_function = (x) => false;
        } else {
          const the_list = item.search_for_ids
            .split("\n")
            .map((x) => x.trim())
            .filter((x) => x !== "");

          filter_function = (x) =>
            the_list.includes(data.node_data.genbanks[x]);
        }
      }

      const enabled =
        (item.category === "mutation" ||
          item.category === "epis" ||
          item.category === "genbanks" ||
          (item.value !== null && item.value !== "")) &&
        item.enabled;
      return {
        original_index: counter,
        id: "main-search-" + counter,
        enabled: enabled,
        data:
          (item.value !== "") |
          (item.category === "mutation" ||
            item.category === "epis" ||
            item.category === "genbanks")
            ? data.node_data.ids.filter(filter_function)
            : [],
        opacity: 0.7,
        getRadius: 7 + counter * 2,
        filled: false,
        stroked: true,
        radiusUnits: "pixels",
        lineWidthUnits: "pixels",
        lineWidthScale: 1,

        getPosition: (d) => {
          return [data.node_data.x[d], data.node_data.y[d]];
        },
        getFillColor: (d) => [0, 0, 0],
        getLineColor: (d) => searchColors[counter % searchColors.length],
      };
    });

    const num_results = configs.map((x) => x.data.length);
    const filtered_configs = configs.filter((item) => item.enabled);
    return [filtered_configs, num_results, scatterIds.length];
  }, [data, searchItems, scatterIds]);

  

  return (
        <div className="main_content">
          <div className="md:grid md:grid-cols-12 h-full">
            <div className="md:col-span-8 h-3/6 md:h-full w-full">
              <Deck
                showMutText={showMutText}
                search_configs_initial={search_configs_initial}
                scatterIds={scatterIds}
                searchColors={searchColors}
                selectedNode={selectedNode}
                setSelectedNode={setSelectedNode}
                searchItems={searchItems}
                data={data}
                progress={nodeData.progress}
                colourBy={colourBy}
                zoomToSearch={ query.zoomToSearch? {index:parseInt(query.zoomToSearch)} : zoomToSearch }
              />
            </div>
            <div className="md:col-span-4 h-full bg-white  border-gray-600   pl-5 shadow-xl">
              <SearchPanel
                showMutText={showMutText}
                setShowMutText={setShowMutText}
                setZoomToSearch={setZoomToSearch}
                totalSeqs={totalSeqs}
                numSearchResults={numSearchResults}
                searchColors={searchColors}
                selectedNode={selectedNode}
                searchItems={searchItems}
                data={data}
                setSearchItems={setSearchItems}
                colourBy={colourBy}
                setColourBy={setColourByWithCheck}
              />
            </div>
          </div>
        </div>
     
  );
}

export default Taxodium;
