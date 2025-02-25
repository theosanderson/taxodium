import { useCallback, useMemo, useState } from "react";
import axios from "axios";

function useServerBackend(backend_url, sid) {
  const [statusMessage, setStatusMessage] = useState({ message: null });
  const queryNodes = useCallback(
    (boundsForQueries, setResult, setTriggerRefresh, config) => {
      let url = backend_url + "/nodes/?type=leaves&sid=" + sid;
      if (
        boundsForQueries &&
        boundsForQueries.min_x &&
        boundsForQueries.max_x &&
        boundsForQueries.min_y &&
        boundsForQueries.max_y
      ) {
        url =
          url +
          "&min_x=" +
          boundsForQueries.min_x +
          "&max_x=" +
          boundsForQueries.max_x +
          "&min_y=" +
          boundsForQueries.min_y +
          "&max_y=" +
          boundsForQueries.max_y;
      }

      if (boundsForQueries && boundsForQueries.xType) {
        url = url + "&xType=" + boundsForQueries.xType;
      }

      axios
        .get(url)
        .then(function (response) {
          console.log("got data - yay", response.data);
          response.data.nodes.forEach((node) => {
            if (node.node_id === config.rootId) {
              // For the root node, leave mutations empty
              // Root mutations are handled separately through config.rootMutations or config.rootSequences
              node.mutations = [];
            } else {
              if (!config.useHydratedMutations) {
                node.mutations = node.mutations.map(
                  (mutation) => config.mutations[mutation]
                );
              }
            }
          });
          setResult(response.data);
        })
        .catch(function (error) {
          console.log(error);
          window.alert(error);
          setResult([]);
          setTriggerRefresh({});
        });
    },
    [backend_url, sid]
  );

  const singleSearch = useCallback(
    (singleSearch, boundsForQueries, setResult) => {
      const abortController = new AbortController();

      let url =
        backend_url +
        "/search/?json=" +
        encodeURIComponent(JSON.stringify(singleSearch)) +
        "&sid=" +
        encodeURIComponent(sid);

      const xType =
        boundsForQueries && boundsForQueries.xType
          ? boundsForQueries.xType
          : "x_dist";

      if (
        boundsForQueries &&
        boundsForQueries.min_x &&
        boundsForQueries.max_x &&
        boundsForQueries.min_y &&
        boundsForQueries.max_y
      ) {
        url =
          url +
          "&min_x=" +
          boundsForQueries.min_x +
          "&max_x=" +
          boundsForQueries.max_x +
          "&min_y=" +
          boundsForQueries.min_y +
          "&max_y=" +
          boundsForQueries.max_y;
      }
      url = url + "&xType=" + xType;

      axios
        .get(url, { signal: abortController.signal })
        .then(function (response) {
          console.log("got data", response.data);
          setResult(response.data);
        })
        .catch(function (error) {
          // if cancelled then do nothing
          if (error.name === "CanceledError") {
            return;
          }
          console.log(error);
          window.alert(error);
          setResult([]);
        });
      return { abortController };
    },
    [backend_url, sid]
  );

  const getDetails = useCallback(
    (node_id, setResult) => {
      let url = backend_url + "/node_details/?id=" + node_id + "&sid=" + sid;
      axios.get(url).then(function (response) {
        setResult(response.data);
      });
    },
    [backend_url, sid]
  );
  const getConfig = useCallback(
    (setResult) => {
      const url = `${backend_url}/config/?sid=${sid}`;

      // Fetch initial config
      axios
        .get(url)
        .then((response) => {
          console.log("got config", response.data);
          if (response.data.error) {
            window.alert(response.data.error + "Error.");
            return;
          }

          const config = response.data;
          if (!config.useHydratedMutations) {
            config.mutations = config.mutations ? config.mutations : [];

            // Stream mutations
            const mutationsUrl = `${backend_url}/mutations/?sid=${sid}`;
            const eventSource = new EventSource(mutationsUrl);

            eventSource.onmessage = (event) => {
              if (event.data === "END") {
                console.log("Finished receiving mutations");
                eventSource.close();
                setResult(config);
                return;
              }

              try {
                const mutationsChunk = JSON.parse(event.data);
                if (Array.isArray(mutationsChunk)) {
                  config.mutations.push(...mutationsChunk);

                  console.log(
                    `Received chunk of ${mutationsChunk.length} mutations`
                  );
                } else {
                  console.error("Received non-array chunk:", mutationsChunk);
                }
              } catch (error) {
                console.error("Error parsing mutations chunk:", error);
              }
            };

            eventSource.onerror = (error) => {
              console.error("EventSource failed:", error);
              eventSource.close();
              setResult(config);
              // TODO atm we set the Result above for backwards compatibility with backends which don't stream mutations and use /config/
              // instead. After a while we should stop doing this so that if the stream dies in the middle we don't get
              // possible weird behavior.
            };
          } else {
            setResult(config);
          }
        })

        .catch((error) => {
          console.error("Error fetching config:", error);

          window.alert("Failed to fetch config. ");
        });
    },
    [backend_url, sid]
  );

  const getTipAtts = useCallback(
    (nodeId, selectedKey, callback) => {
      let url =
        backend_url +
        "/tip_atts?id=" +
        nodeId +
        "&att=" +
        selectedKey +
        "&sid=" +
        sid;
      axios.get(url).then(function (response) {
        callback(response.err, response.data);
      });
    },
    [backend_url, sid]
  );

  const getNextstrainJsonUrl = useCallback(
    (nodeId, config) => {
      return backend_url + "/nextstrain_json/" + nodeId;
    },
    [backend_url]
  );

  const getNextstrainJson = useCallback(
    (nodeId, config) => {
      const url = getNextstrainJsonUrl(nodeId, config);
      // load this
      window.location.href = url;
    },
    [getNextstrainJsonUrl]
  );

  return useMemo(() => {
    return {
      queryNodes,
      singleSearch,
      getDetails,
      getConfig,
      setStatusMessage,
      statusMessage,
      getTipAtts,
      type: "server",
      backend_url: backend_url,
      getNextstrainJson,
      getNextstrainJsonUrl,
    };
  }, [
    queryNodes,
    singleSearch,
    getDetails,
    getConfig,
    setStatusMessage,
    statusMessage,
    getTipAtts,
    backend_url,
    getNextstrainJson,
    getNextstrainJsonUrl,
  ]);
}

export default useServerBackend;
